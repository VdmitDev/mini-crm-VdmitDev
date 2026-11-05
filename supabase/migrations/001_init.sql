-- =============================================================================
-- Мини-CRM «Объекты и задачи»: начальная миграция
--
-- Что внутри:
--   1. Типы: роли сотрудников и статусы задач
--   2. Таблицы: profiles, projects, tasks, task_status_transitions, task_history
--   3. Вспомогательные функции (схема private, наружу через API не публикуется)
--   4. Триггеры: проверка workflow, автозапись истории, защита истории
--   5. RPC change_task_status: смена статуса с комментарием
--   6. Права доступа: GRANT и RLS-политики
--
-- Главный принцип: правила живут в базе. Интерфейс только прячет недоступные
-- кнопки, а любой запрос к API (в том числе ручной, в обход интерфейса)
-- все равно проходит через RLS-политики и триггеры ниже.
--
-- В коде объект (стройка) называется project, постановщик manager,
-- исполнитель assignee.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Типы
-- -----------------------------------------------------------------------------

-- Роль хранится в таблице profiles, а не в user_metadata: метаданные пользователь
-- может задать себе сам при регистрации, а profiles меняет только администратор.
create type public.user_role as enum ('manager', 'assignee');

-- Коды статусов на английском, русские названия показывает интерфейс.
create type public.task_status as enum (
  'new',            -- Новая
  'in_progress',    -- В работе
  'under_review',   -- На проверке
  'needs_revision', -- На доработке
  'accepted'        -- Принята
);


-- -----------------------------------------------------------------------------
-- 2. Таблицы
-- -----------------------------------------------------------------------------

-- Профиль сотрудника: имя и роль. Строку создает администратор (см. supabase/seed.sql).
-- Пользователь без профиля не имеет роли и не видит никаких данных, даже если
-- каким-то образом смог зарегистрироваться.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 1 and 100),
  role       public.user_role not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Сотрудники и их роли. Редактирует только администратор.';

-- Объект (стройка).
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 200),
  address    text not null check (char_length(btrim(address)) between 1 and 300),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is 'Объекты (стройки).';

create index projects_created_by_idx on public.projects (created_by);

-- Задача по объекту. Исполнитель обязателен: без него задачу некому взять в работу.
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  assignee_id uuid not null references public.profiles (id),
  author_id   uuid not null default auth.uid() references public.profiles (id),
  status      public.task_status not null default 'new',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tasks is 'Задачи по объектам. Статус меняется только по правилам из task_status_transitions.';

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_author_id_idx on public.tasks (author_id);

-- Разрешенные переходы статусов. Это белый список: всего, чего здесь нет, делать нельзя.
-- Таблицу читают и триггер (проверка в базе), и интерфейс (какие кнопки показать),
-- поэтому правила описаны ровно в одном месте и не могут разойтись.
--   allowed_role = 'manager'  : любой постановщик
--   allowed_role = 'assignee' : только исполнитель, назначенный на эту задачу
create table public.task_status_transitions (
  from_status      public.task_status not null,
  to_status        public.task_status not null,
  allowed_role     public.user_role not null,
  requires_comment boolean not null default false,
  primary key (from_status, to_status),
  check (from_status <> to_status)
);

comment on table public.task_status_transitions is 'Белый список переходов статусов. Все остальные переходы запрещены.';

insert into public.task_status_transitions (from_status, to_status, allowed_role, requires_comment) values
  ('new',            'in_progress',    'assignee', false),
  ('in_progress',    'under_review',   'assignee', false),
  ('under_review',   'accepted',       'manager',  false),
  ('under_review',   'needs_revision', 'manager',  true),
  ('needs_revision', 'in_progress',    'assignee', false);

-- История смены статусов. Записи создает только база (триггеры на tasks),
-- клиент сюда писать не может. Изменять и удалять записи нельзя никому.
create table public.task_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  changed_by  uuid not null references public.profiles (id),
  from_status public.task_status,   -- null означает, что задачу только что создали
  to_status   public.task_status not null,
  comment     text check (char_length(comment) <= 2000),
  created_at  timestamptz not null default now()
);

comment on table public.task_history is 'Журнал смены статусов. Только добавление, заполняется триггерами.';

create index task_history_task_id_idx on public.task_history (task_id, id);
create index task_history_changed_by_idx on public.task_history (changed_by);


-- -----------------------------------------------------------------------------
-- 3. Вспомогательные функции
--
-- Схема private не входит в список схем, которые Supabase отдает через API,
-- поэтому вызвать эти функции как RPC снаружи нельзя.
-- -----------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

-- Роль текущего пользователя или null, если профиля нет.
-- security definer нужен, чтобы читать profiles в обход RLS: политика на profiles
-- сама вызывает эту функцию, и без этого получилась бы бесконечная рекурсия.
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'manager', false);
$$;

-- Русское название статуса для понятных сообщений об ошибках.
create or replace function private.task_status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new'            then 'Новая'
    when 'in_progress'    then 'В работе'
    when 'under_review'   then 'На проверке'
    when 'needs_revision' then 'На доработке'
    when 'accepted'       then 'Принята'
  end;
$$;

-- Исполнителем можно назначить только сотрудника с ролью assignee.
create or replace function private.assert_valid_assignee(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles where id = p_user_id and role = 'assignee'
  ) then
    raise exception 'Исполнителем можно назначить только сотрудника с ролью «Исполнитель»';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Триггеры
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();


-- 4.1. Создание задачи --------------------------------------------------------

create or replace function private.tasks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  -- Автор задачи всегда тот, кто ее создает: подставить чужое имя нельзя.
  if v_actor_id is not null then
    new.author_id := v_actor_id;
  end if;

  if not exists (
    select 1 from public.profiles where id = new.author_id and role = 'manager'
  ) then
    raise exception 'Создавать задачи может только постановщик' using errcode = '42501';
  end if;

  -- По ТЗ задача появляется только в статусе «Новая».
  if new.status <> 'new' then
    raise exception 'Задача создается только в статусе «Новая»';
  end if;

  perform private.assert_valid_assignee(new.assignee_id);

  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function private.tasks_before_insert();

-- Создание задачи тоже событие истории: «нет статуса» → «Новая».
create or replace function private.tasks_log_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (task_id, changed_by, from_status, to_status)
  values (new.id, new.author_id, null, new.status);
  return null;
end;
$$;

create trigger tasks_log_creation
  after insert on public.tasks
  for each row execute function private.tasks_log_creation();


-- 4.2. Изменение задачи и workflow статусов -----------------------------------

-- Комментарий к смене статуса приходит не через колонку таблицы, а через
-- настройку транзакции app.status_comment. Ее выставляет RPC change_task_status.
-- Если статус поменяли обычным UPDATE в обход RPC, комментария просто не будет,
-- и переход, где он обязателен, не пройдет.
create or replace function private.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_actor_role public.user_role := private.current_user_role();
  v_comment    text := nullif(btrim(current_setting('app.status_comment', true)), '');
  v_rule       public.task_status_transitions%rowtype;
begin
  -- Служебные поля не меняет никто, включая постановщика.
  if new.id is distinct from old.id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Нельзя менять идентификатор, автора и дату создания задачи'
      using errcode = '42501';
  end if;

  -- Исполнитель меняет только статус своей задачи. Название, описание, объект
  -- и исполнителя редактирует постановщик.
  if v_actor_role = 'assignee' and (
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.project_id  is distinct from old.project_id
    or new.assignee_id is distinct from old.assignee_id
  ) then
    raise exception 'Исполнитель может менять только статус задачи' using errcode = '42501';
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    perform private.assert_valid_assignee(new.assignee_id);
  end if;

  if new.status is distinct from old.status then
    -- Каждая смена статуса попадает в историю с автором. Поэтому статус меняет
    -- только сотрудник с ролью; у сервисного ключа (service_role) пользователя нет.
    if v_actor_id is null or v_actor_role is null then
      raise exception 'Статус задачи может менять только сотрудник с ролью в системе'
        using errcode = '42501';
    end if;

    select * into v_rule
      from public.task_status_transitions
     where from_status = old.status
       and to_status = new.status;

    if not found then
      raise exception 'Переход из статуса «%» в «%» запрещен',
        private.task_status_label(old.status), private.task_status_label(new.status);
    end if;

    if v_rule.allowed_role = 'manager' and v_actor_role <> 'manager' then
      raise exception 'Перевести задачу в статус «%» может только постановщик',
        private.task_status_label(new.status)
        using errcode = '42501';
    end if;

    if v_rule.allowed_role = 'assignee'
       and (v_actor_role <> 'assignee' or old.assignee_id <> v_actor_id) then
      raise exception 'Перевести задачу в статус «%» может только назначенный на нее исполнитель',
        private.task_status_label(new.status)
        using errcode = '42501';
    end if;

    if v_rule.requires_comment and v_comment is null then
      raise exception 'Для перевода в статус «%» нужен комментарий',
        private.task_status_label(new.status);
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function private.tasks_before_update();

-- Запись в историю делает база, а не клиент: автор, время и статусы берутся
-- из самой транзакции, поэтому подделать их нельзя.
create or replace function private.tasks_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
  values (
    new.id,
    auth.uid(),
    old.status,
    new.status,
    nullif(btrim(current_setting('app.status_comment', true)), '')
  );

  -- Комментарий одноразовый: сбрасываем его, чтобы он не прилип к следующей
  -- смене статуса в той же транзакции.
  perform set_config('app.status_comment', '', true);
  return null;
end;
$$;

create trigger tasks_log_status_change
  after update of status on public.tasks
  for each row
  when (old.status is distinct from new.status)
  execute function private.tasks_log_status_change();


-- 4.3. Защита истории ---------------------------------------------------------

-- История только пополняется. Эти проверки срабатывают для любой роли, в том
-- числе для сервисного ключа service_role, который обходит RLS.
create or replace function private.task_history_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Настоящая запись приходит только из триггера на tasks, то есть изнутри
    -- другого триггера (глубина вложенности 2). Прямой INSERT отклоняем.
    if pg_trigger_depth() < 2 then
      raise exception 'Записи истории создаются автоматически, добавлять их вручную нельзя'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'Историю статусов нельзя изменять' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    -- Удаление возможно только каскадом, когда постановщик удалил саму задачу
    -- (или весь объект). Пока задача существует, ее история неприкосновенна.
    if exists (select 1 from public.tasks where id = old.task_id) then
      raise exception 'Историю статусов нельзя удалять' using errcode = '42501';
    end if;
    return old;
  end if;

  -- TRUNCATE
  raise exception 'Историю статусов нельзя очищать' using errcode = '42501';
end;
$$;

create trigger task_history_guard
  before insert or update or delete on public.task_history
  for each row execute function private.task_history_guard();

create trigger task_history_guard_truncate
  before truncate on public.task_history
  for each statement execute function private.task_history_guard();


-- -----------------------------------------------------------------------------
-- 5. RPC: смена статуса с комментарием
-- -----------------------------------------------------------------------------

-- Единая точка смены статуса для интерфейса. Функция работает с правами
-- вызывающего (security invoker): RLS действует как при обычном запросе,
-- а все правила workflow проверяет триггер tasks_before_update. Своих
-- «суперспособностей» у функции нет, она только передает триггеру комментарий.
create or replace function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_status public.task_status;
  v_task           public.tasks;
begin
  if char_length(p_comment) > 2000 then
    raise exception 'Комментарий не должен быть длиннее 2000 символов';
  end if;

  -- Блокируем строку, чтобы между проверкой и обновлением статус никто не поменял.
  -- Чужую задачу RLS просто не покажет, и мы честно ответим «не найдена».
  select status into v_current_status
    from public.tasks
   where id = p_task_id
     for update;

  if not found then
    raise exception 'Задача не найдена или у вас нет к ней доступа';
  end if;

  if v_current_status = p_new_status then
    raise exception 'Задача уже в статусе «%»', private.task_status_label(p_new_status);
  end if;

  perform set_config('app.status_comment', coalesce(p_comment, ''), true);

  update public.tasks
     set status = p_new_status
   where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. Права доступа
-- -----------------------------------------------------------------------------

-- Функции: внутренние доступны только авторизованным (их вызывают политики),
-- RPC смены статуса тоже только авторизованным. Аноним не может ничего.
revoke execute on all functions in schema private from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.task_status_label(public.task_status) to authenticated;

revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- Supabase по умолчанию выдает ролям anon и authenticated все права на новые
-- таблицы в public и полагается на RLS. Мы сужаем права заранее: анониму не
-- даем ничего, авторизованным только нужное. Заодно уходит TRUNCATE, на который
-- RLS не действует.
revoke all on table
  public.profiles,
  public.projects,
  public.tasks,
  public.task_status_transitions,
  public.task_history
from anon, authenticated;

grant select on table
  public.profiles,
  public.projects,
  public.tasks,
  public.task_status_transitions,
  public.task_history
to authenticated;

-- Права на уровне колонок: клиент передает только «пользовательские» поля.
-- Автора, статус при создании, даты и идентификаторы проставляет база.
-- Записывать в profiles, task_history и task_status_transitions клиент не может вообще.
grant insert (name, address) on public.projects to authenticated;
grant update (name, address) on public.projects to authenticated;
grant delete on public.projects to authenticated;

grant insert (project_id, title, description, assignee_id) on public.tasks to authenticated;
grant update (project_id, title, description, assignee_id, status) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;


-- RLS: какие строки видит и меняет каждый пользователь -----------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_transitions enable row level security;
alter table public.task_history enable row level security;

-- Вызовы функций обернуты в (select ...), чтобы Postgres вычислял их один раз
-- на запрос, а не для каждой строки (рекомендация Supabase по производительности RLS).

-- profiles: свой профиль видят все; постановщик видит всех (выбирает исполнителя);
-- исполнитель видит постановщиков (кто поставил и проверил задачу), но не других исполнителей.
-- Политик на INSERT/UPDATE/DELETE нет: роли назначает только администратор.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_manager())
    or (role = 'manager' and (select private.current_user_role()) = 'assignee')
  );

-- projects: постановщик видит все объекты, исполнитель только те, где у него есть задачи.
create policy projects_select on public.projects
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1
        from public.tasks
       where tasks.project_id = projects.id
         and tasks.assignee_id = (select auth.uid())
    )
  );

create policy projects_insert on public.projects
  for insert to authenticated
  with check ((select private.is_manager()));

create policy projects_update on public.projects
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy projects_delete on public.projects
  for delete to authenticated
  using ((select private.is_manager()));

-- tasks: постановщик видит и меняет все задачи, исполнитель только назначенные ему.
create policy tasks_select on public.tasks
  for select to authenticated
  using ((select private.is_manager()) or assignee_id = (select auth.uid()));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check ((select private.is_manager()));

-- Исполнитель проходит эту политику только для своей задачи, а что именно он
-- может в ней поменять (только статус и только по правилам), решает триггер.
create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_manager()) or assignee_id = (select auth.uid()))
  with check ((select private.is_manager()) or assignee_id = (select auth.uid()));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((select private.is_manager()));

-- task_status_transitions: правила читают все сотрудники с ролью, менять не может никто.
create policy task_status_transitions_select on public.task_status_transitions
  for select to authenticated
  using ((select private.current_user_role()) is not null);

-- task_history: только чтение и только по тем задачам, которые пользователь видит.
create policy task_history_select on public.task_history
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1
        from public.tasks
       where tasks.id = task_history.task_id
         and tasks.assignee_id = (select auth.uid())
    )
  );

-- Просим PostgREST (API Supabase) перечитать схему, чтобы новые таблицы и RPC
-- были доступны сразу.
notify pgrst, 'reload schema';
