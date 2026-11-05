-- =============================================================================
-- Проверка защиты данных на уровне базы.
--
-- Как запустить: Supabase Dashboard → SQL Editor → вставить файл целиком → Run.
-- Запускать после seed.sql: проверки опираются на демо-данные.
--
-- Каждая проверка выполняется от имени конкретного пользователя: скрипт
-- переключается на роль authenticated (или anon / service_role) и подставляет
-- id пользователя в JWT, точно так же, как это делает API Supabase. То есть это
-- те же запросы, которые можно отправить вручную в обход интерфейса.
--
-- Каждая проверка работает в подтранзакции и откатывается, поэтому скрипт
-- ничего не меняет в базе, и его можно запускать сколько угодно раз.
-- Результат: таблица с итогом OK/FAIL по каждой проверке (провалы наверху).
-- =============================================================================

drop table if exists pg_temp.security_check_results;

create temp table security_check_results (
  id       serial primary key,
  title    text not null,
  actor    text not null,
  expected text not null,
  passed   boolean not null,
  details  text
);

-- Справочные функции: находят id демо-записей, чтобы подставить их в запросы.
create or replace function pg_temp.user_id(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    raise exception 'Пользователь % не найден. Сначала выполните seed.sql.', p_email;
  end if;
  return v_id;
end;
$$;

create or replace function pg_temp.task_id(p_title text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.tasks where title = p_title;
  if v_id is null then
    raise exception 'Задача «%» не найдена. Сначала выполните seed.sql.', p_title;
  end if;
  return v_id;
end;
$$;

create or replace function pg_temp.project_id(p_name_prefix text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.projects where name like p_name_prefix || '%';
  if v_id is null then
    raise exception 'Объект «%...» не найден. Сначала выполните seed.sql.', p_name_prefix;
  end if;
  return v_id;
end;
$$;

-- Выполняет запрос от имени пользователя и сравнивает результат с ожиданием.
--   p_actor  : email сотрудника, 'anon' (без входа), 'service_role' (сервисный ключ)
--              или 'no_profile' (вошел, но администратор не выдал ему роль)
--   p_expect : 'error'   запрос должен быть отклонен
--              'rows=N'  запрос должен затронуть ровно N строк
--              'value=N' запрос должен вернуть число N
--   p_setup  : необязательный запрос, выполняется перед проверочным в той же подтранзакции
create or replace function pg_temp.run_check(
  p_title  text,
  p_actor  text,
  p_expect text,
  p_sql    text,
  p_setup  text default null
)
returns void
language plpgsql
as $$
declare
  v_actor_id  uuid;
  v_db_role   text := 'authenticated';
  v_value     bigint;
  v_row_count bigint;
  v_error     text;
  v_passed    boolean;
begin
  case p_actor
    when 'anon' then
      v_db_role := 'anon';
    when 'service_role' then
      v_db_role := 'service_role';
    when 'no_profile' then
      v_actor_id := gen_random_uuid();
    else
      v_actor_id := pg_temp.user_id(p_actor);
  end case;

  begin
    -- Представляемся пользователем так же, как это делает API Supabase.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_actor_id, 'role', v_db_role)::text, true);
    perform set_config('role', v_db_role, true);

    begin
      if p_setup is not null then
        execute p_setup;
      end if;

      if p_expect like 'value=%' then
        execute p_sql into v_value;
      else
        execute p_sql;
        get diagnostics v_row_count = row_count;
      end if;
    exception when others then
      v_error := sqlerrm;
    end;

    -- Откатываем все, что сделала проверка, вместе со сменой роли.
    raise exception using errcode = 'P0099', message = 'rollback security check';
  exception when sqlstate 'P0099' then
    null;
  end;

  v_passed := case
    when p_expect = 'error'      then v_error is not null
    when p_expect like 'rows=%'  then v_error is null and v_row_count = split_part(p_expect, '=', 2)::bigint
    when p_expect like 'value=%' then v_error is null and v_value = split_part(p_expect, '=', 2)::bigint
  end;

  insert into security_check_results (title, actor, expected, passed, details)
  values (
    p_title,
    p_actor,
    p_expect,
    coalesce(v_passed, false),
    coalesce(
      v_error,
      case
        when p_expect like 'value=%' then 'вернул: ' || coalesce(v_value::text, 'null')
        else 'затронуто строк: ' || coalesce(v_row_count::text, '0')
      end
    )
  );
end;
$$;

do $checks$
declare
  c_manager constant text := 'manager@example.com';
  c_ivanov  constant text := 'ivanov@example.com';
  c_petrov  constant text := 'petrov@example.com';

  -- Задачи Петрова
  v_gates_task      uuid := pg_temp.task_id('Монтаж секционных ворот (4 шт.)');        -- Новая
  v_waterproof_task uuid := pg_temp.task_id('Гидроизоляция фундамента, секция Б');     -- На проверке
  -- Задачи Иванова
  v_facade_task     uuid := pg_temp.task_id('Утепление фасада минватой 100 мм');       -- Новая
  v_wiring_task     uuid := pg_temp.task_id('Электромонтаж в МОП, 1-3 этажи');         -- В работе
  v_roof_task       uuid := pg_temp.task_id('Монтаж кровли из металлочерепицы');       -- На проверке
  v_rebar_task      uuid := pg_temp.task_id('Армирование плиты перекрытия 5 этажа');   -- Принята

  v_warehouse_id uuid := pg_temp.project_id('Склад');
  v_ivanov_id    uuid := pg_temp.user_id(c_ivanov);
  v_petrov_id    uuid := pg_temp.user_id(c_petrov);
begin
  -- 1. Без входа (только публичный ключ) не доступно ничего ------------------

  perform pg_temp.run_check('Аноним не может читать объекты', 'anon', 'error',
    $q$select count(*) from public.projects$q$);
  perform pg_temp.run_check('Аноним не может читать задачи', 'anon', 'error',
    $q$select count(*) from public.tasks$q$);
  perform pg_temp.run_check('Аноним не может читать историю', 'anon', 'error',
    $q$select count(*) from public.task_history$q$);
  perform pg_temp.run_check('Аноним не может вызвать смену статуса', 'anon', 'error',
    format($q$select public.change_task_status(%L, 'accepted')$q$, v_waterproof_task));

  -- 2. Исполнитель видит только свое ------------------------------------------

  perform pg_temp.run_check('Исполнитель не видит чужие задачи', c_petrov, 'value=0',
    $q$select count(*) from public.tasks where assignee_id <> auth.uid()$q$);
  perform pg_temp.run_check('Исполнитель видит все свои задачи (4 шт.)', c_petrov, 'value=4',
    $q$select count(*) from public.tasks$q$);
  perform pg_temp.run_check('Исполнитель видит только объекты со своими задачами (2 из 3)', c_petrov, 'value=2',
    $q$select count(*) from public.projects$q$);
  perform pg_temp.run_check('Объект, где у исполнителя нет задач, ему не виден', c_petrov, 'value=0',
    $q$select count(*) from public.projects where name like 'Коттедж%'$q$);
  perform pg_temp.run_check('Исполнитель не видит историю чужой задачи', c_petrov, 'value=0',
    format($q$select count(*) from public.task_history where task_id = %L$q$, v_roof_task));
  perform pg_temp.run_check('Исполнитель не видит профили других исполнителей', c_petrov, 'value=0',
    $q$select count(*) from public.profiles where role = 'assignee' and id <> auth.uid()$q$);

  -- 3. Чужие задачи изменить нельзя ---------------------------------------------

  perform pg_temp.run_check('Исполнитель не может изменить чужую задачу (база ее «не находит»)', c_petrov, 'rows=0',
    format($q$update public.tasks set status = 'in_progress' where id = %L$q$, v_facade_task));
  perform pg_temp.run_check('Исполнитель не может сменить статус чужой задачи через RPC', c_petrov, 'error',
    format($q$select public.change_task_status(%L, 'in_progress')$q$, v_facade_task));
  perform pg_temp.run_check('Исполнитель не может удалить даже свою задачу', c_petrov, 'rows=0',
    format($q$delete from public.tasks where id = %L$q$, v_gates_task));

  -- 4. Свою задачу исполнитель двигает только по правилам ------------------------

  perform pg_temp.run_check('Нельзя перепрыгнуть этап: «Новая» → «Принята»', c_petrov, 'error',
    format($q$update public.tasks set status = 'accepted' where id = %L$q$, v_gates_task));
  perform pg_temp.run_check('Нельзя перепрыгнуть этап: «Новая» → «На проверке»', c_petrov, 'error',
    format($q$update public.tasks set status = 'under_review' where id = %L$q$, v_gates_task));
  perform pg_temp.run_check('Исполнитель не может сам принять свою работу', c_petrov, 'error',
    format($q$update public.tasks set status = 'accepted' where id = %L$q$, v_waterproof_task));
  perform pg_temp.run_check('Исполнитель не может сам вернуть задачу на доработку', c_petrov, 'error',
    format($q$select public.change_task_status(%L, 'needs_revision', 'Сам себе замечание')$q$, v_waterproof_task));
  perform pg_temp.run_check('Исполнитель не может менять название своей задачи', c_petrov, 'error',
    format($q$update public.tasks set title = 'Другое название' where id = %L$q$, v_gates_task));
  perform pg_temp.run_check('Исполнитель не может переназначить задачу на другого', c_petrov, 'error',
    format($q$update public.tasks set assignee_id = %L where id = %L$q$, v_ivanov_id, v_gates_task));
  perform pg_temp.run_check('Исполнитель не может создать задачу', c_petrov, 'error',
    format($q$insert into public.tasks (project_id, title, assignee_id) values (%L, 'Тест', auth.uid())$q$, v_warehouse_id));
  perform pg_temp.run_check('Исполнитель не может создать объект', c_petrov, 'error',
    $q$insert into public.projects (name, address) values ('Тест', 'Тест')$q$);
  perform pg_temp.run_check('Исполнитель не может выдать себе роль постановщика', c_petrov, 'error',
    $q$update public.profiles set role = 'manager' where id = auth.uid()$q$);
  perform pg_temp.run_check('Разрешенный переход работает: исполнитель берет новую задачу в работу', c_petrov, 'rows=1',
    format($q$update public.tasks set status = 'in_progress' where id = %L$q$, v_gates_task));
  perform pg_temp.run_check('Переход записан в историю от имени исполнителя', c_petrov, 'value=1',
    format($q$select count(*) from public.task_history
               where task_id = %1$L and from_status = 'new' and to_status = 'in_progress'
                 and changed_by = auth.uid()$q$, v_gates_task),
    format($q$select public.change_task_status(%L, 'in_progress')$q$, v_gates_task));

  -- 5. Постановщик тоже работает по правилам -------------------------------------

  perform pg_temp.run_check('Постановщик не может взять задачу в работу за исполнителя', c_manager, 'error',
    format($q$update public.tasks set status = 'in_progress' where id = %L$q$, v_facade_task));
  perform pg_temp.run_check('Постановщик не может отправить задачу на проверку за исполнителя', c_manager, 'error',
    format($q$update public.tasks set status = 'under_review' where id = %L$q$, v_wiring_task));
  perform pg_temp.run_check('Нельзя вернуть на доработку без комментария', c_manager, 'error',
    format($q$update public.tasks set status = 'needs_revision' where id = %L$q$, v_roof_task));
  perform pg_temp.run_check('Комментарий из одних пробелов не считается', c_manager, 'error',
    format($q$select public.change_task_status(%L, 'needs_revision', '   ')$q$, v_roof_task));
  perform pg_temp.run_check('Возврат с комментарием проходит, комментарий сохраняется в истории', c_manager, 'value=1',
    format($q$select count(*) from public.task_history
               where task_id = %L and to_status = 'needs_revision'
                 and comment = 'Проверка: добавить второй слой' and changed_by = auth.uid()$q$, v_roof_task),
    format($q$select public.change_task_status(%L, 'needs_revision', 'Проверка: добавить второй слой')$q$, v_roof_task));
  perform pg_temp.run_check('Принятая задача закрыта: вернуть ее на доработку нельзя', c_manager, 'error',
    format($q$select public.change_task_status(%L, 'needs_revision', 'Передумал')$q$, v_rebar_task));
  perform pg_temp.run_check('Нельзя создать задачу сразу в статусе «Принята»', c_manager, 'error',
    format($q$insert into public.tasks (project_id, title, assignee_id, status) values (%L, 'Тест', %L, 'accepted')$q$,
      v_warehouse_id, v_petrov_id));
  perform pg_temp.run_check('Нельзя подставить другого автора задачи', c_manager, 'error',
    format($q$insert into public.tasks (project_id, title, assignee_id, author_id) values (%L, 'Тест', %L, %L)$q$,
      v_warehouse_id, v_petrov_id, v_ivanov_id));
  perform pg_temp.run_check('Нельзя изменить автора существующей задачи', c_manager, 'error',
    format($q$update public.tasks set author_id = %L where id = %L$q$, v_ivanov_id, v_gates_task));
  perform pg_temp.run_check('Исполнителем нельзя назначить постановщика', c_manager, 'error',
    format($q$insert into public.tasks (project_id, title, assignee_id) values (%L, 'Тест', auth.uid())$q$, v_warehouse_id));
  perform pg_temp.run_check('Новая задача: автора, статус «Новая» и первую запись истории ставит база', c_manager, 'value=1',
    $q$select count(*) from public.tasks t
        where t.title = 'Проверочная задача' and t.author_id = auth.uid() and t.status = 'new'
          and exists (select 1 from public.task_history h
                       where h.task_id = t.id and h.from_status is null and h.to_status = 'new')$q$,
    format($q$insert into public.tasks (project_id, title, assignee_id) values (%L, 'Проверочная задача', %L)$q$,
      v_warehouse_id, v_petrov_id));

  -- 6. История: только добавление, и только самой базой ---------------------------

  perform pg_temp.run_check('Исполнитель не может добавить запись в историю', c_petrov, 'error',
    format($q$insert into public.task_history (task_id, changed_by, from_status, to_status)
              values (%L, auth.uid(), 'under_review', 'accepted')$q$, v_waterproof_task));
  perform pg_temp.run_check('Постановщик не может исправить запись истории', c_manager, 'error',
    $q$update public.task_history set comment = 'Подделка'$q$);
  perform pg_temp.run_check('Постановщик не может удалить запись истории', c_manager, 'error',
    $q$delete from public.task_history$q$);
  perform pg_temp.run_check('Даже service_role не может добавить запись в историю', 'service_role', 'error',
    format($q$insert into public.task_history (task_id, changed_by, from_status, to_status)
              values (%L, %L, 'under_review', 'accepted')$q$, v_waterproof_task, v_petrov_id));
  perform pg_temp.run_check('Даже service_role не может изменить историю', 'service_role', 'error',
    $q$update public.task_history set comment = 'Подделка'$q$);
  perform pg_temp.run_check('Даже service_role не может удалить историю', 'service_role', 'error',
    $q$delete from public.task_history$q$);
  perform pg_temp.run_check('Даже service_role не может очистить историю (TRUNCATE)', 'service_role', 'error',
    $q$truncate public.task_history$q$);
  perform pg_temp.run_check('Даже service_role не может сменить статус в обход workflow', 'service_role', 'error',
    format($q$update public.tasks set status = 'accepted' where id = %L$q$, v_waterproof_task));
  perform pg_temp.run_check('Удаление задачи постановщиком удаляет и ее историю (каскад разрешен)', c_manager, 'value=0',
    format($q$select count(*) from public.task_history where task_id = %L$q$, v_rebar_task),
    format($q$delete from public.tasks where id = %L$q$, v_rebar_task));

  -- 7. Пользователь без профиля (если регистрацию по ошибке оставили включенной) ---

  perform pg_temp.run_check('Пользователь без роли не видит объекты', 'no_profile', 'value=0',
    $q$select count(*) from public.projects$q$);
  perform pg_temp.run_check('Пользователь без роли не видит задачи', 'no_profile', 'value=0',
    $q$select count(*) from public.tasks$q$);
  perform pg_temp.run_check('Пользователь без роли не может создать себе профиль', 'no_profile', 'error',
    $q$insert into public.profiles (id, full_name, role) values (auth.uid(), 'Хакер', 'manager')$q$);
end;
$checks$;

select
  id                                        as "№",
  case when passed then 'OK' else 'FAIL' end as "Итог",
  title                                     as "Проверка",
  actor                                     as "От имени",
  expected                                  as "Ожидание",
  details                                   as "Ответ базы"
from security_check_results
order by passed, id;
