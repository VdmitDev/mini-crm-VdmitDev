-- =============================================================================
-- Демо-данные: 3 сотрудника, 3 объекта и 8 задач во всех статусах.
--
-- ПЕРЕД ЗАПУСКОМ создайте трех пользователей в Supabase Dashboard:
-- Authentication → Users → Add user → Create new user (галочка Auto Confirm User).
--   manager@example.com  : постановщик
--   ivanov@example.com   : исполнитель
--   petrov@example.com   : исполнитель
-- Пароли придумайте сами, в репозитории их нет. Если хотите другие email,
-- поменяйте константы в начале блока ниже.
--
-- Скрипт выполняет действия «от имени» сотрудников (подставляет их id в
-- request.jwt.claims, как это делает API Supabase). Поэтому задачи проходят
-- через те же триггеры, что и запросы из приложения, а история статусов
-- получается настоящей, а не вставленной вручную.
--
-- Рассчитан на пустую базу сразу после миграции 001_init.sql.
-- =============================================================================

-- Временная функция (живет до конца сессии): «войти» как сотрудник.
create or replace function pg_temp.act_as(p_user_id uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

do $$
declare
  c_manager_email constant text := 'manager@example.com';
  c_ivanov_email  constant text := 'ivanov@example.com';
  c_petrov_email  constant text := 'petrov@example.com';

  v_manager_id uuid;
  v_ivanov_id  uuid;
  v_petrov_id  uuid;

  v_residential_id uuid;
  v_cottage_id     uuid;
  v_warehouse_id   uuid;

  v_task_id uuid;
begin
  select id into v_manager_id from auth.users where email = c_manager_email;
  select id into v_ivanov_id  from auth.users where email = c_ivanov_email;
  select id into v_petrov_id  from auth.users where email = c_petrov_email;

  if v_manager_id is null or v_ivanov_id is null or v_petrov_id is null then
    raise exception 'Не найдены пользователи %, %, %. Сначала создайте их в Authentication → Users.',
      c_manager_email, c_ivanov_email, c_petrov_email;
  end if;

  if exists (select 1 from public.projects) then
    raise exception 'В базе уже есть объекты. Демо-данные рассчитаны на пустую базу.';
  end if;

  -- Роли назначает администратор: этот шаг выполняется от его имени (владелец БД).
  insert into public.profiles (id, full_name, role) values
    (v_manager_id, 'Алексей Морозов', 'manager'),
    (v_ivanov_id,  'Дмитрий Иванов',  'assignee'),
    (v_petrov_id,  'Сергей Петров',   'assignee')
  on conflict (id) do update
    set full_name = excluded.full_name,
        role      = excluded.role;

  -- Объекты создает постановщик.
  perform pg_temp.act_as(v_manager_id);

  insert into public.projects (name, address)
  values ('ЖК «Северный парк», корпус 2', 'г. Москва, ул. Лесная, д. 12')
  returning id into v_residential_id;

  insert into public.projects (name, address)
  values ('Коттедж в КП «Сосновый бор»', 'Московская обл., Истринский р-н, КП «Сосновый бор», уч. 47')
  returning id into v_cottage_id;

  insert into public.projects (name, address)
  values ('Склад «ЛогистикПро»', 'г. Подольск, Индустриальная ул., д. 3')
  returning id into v_warehouse_id;

  -- ЖК: задачи обоих исполнителей ----------------------------------------------

  -- Принята: полный цикл без замечаний.
  perform pg_temp.act_as(v_manager_id);
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_residential_id,
    'Армирование плиты перекрытия 5 этажа',
    'Связать арматурный каркас плиты по чертежу КЖ-12, лист 4. Защитный слой 25 мм, шаг стержней 200 мм. Перед бетонированием вызвать технадзор.',
    v_ivanov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_ivanov_id);
  perform public.change_task_status(v_task_id, 'in_progress');
  perform public.change_task_status(v_task_id, 'under_review', 'Каркас связан, фото в чате объекта. Технадзор вызвал на завтра.');

  perform pg_temp.act_as(v_manager_id);
  perform public.change_task_status(v_task_id, 'accepted', 'Технадзор замечаний не нашел, можно бетонировать.');

  -- На доработке: постановщик вернул с комментарием.
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_residential_id,
    'Монтаж оконных блоков, секция А',
    'Установить ПВХ-окна в квартирах 49-56 (секция А, 7 этаж). Монтажные швы по ГОСТ 30971: пена, пароизоляционная лента изнутри, ПСУЛ снаружи.',
    v_petrov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_petrov_id);
  perform public.change_task_status(v_task_id, 'in_progress');
  perform public.change_task_status(v_task_id, 'under_review', 'Все 8 окон установлены.');

  perform pg_temp.act_as(v_manager_id);
  perform public.change_task_status(
    v_task_id,
    'needs_revision',
    'В квартирах 51, 53 и 54 нет пароизоляционной ленты изнутри. Доделайте и пришлите фото узлов.'
  );

  -- В работе.
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_residential_id,
    'Электромонтаж в МОП, 1-3 этажи',
    'Проложить кабельные линии освещения в коридорах и лифтовых холлах 1-3 этажей по проекту ЭО. Светильники пока не вешать, только кабель и подрозетники.',
    v_ivanov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_ivanov_id);
  perform public.change_task_status(v_task_id, 'in_progress');

  -- На проверке.
  perform pg_temp.act_as(v_manager_id);
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_residential_id,
    'Гидроизоляция фундамента, секция Б',
    'Обмазочная гидроизоляция в 2 слоя по праймеру, затем утеплитель ЭППС 50 мм. Фото каждого этапа до обратной засыпки обязательно.',
    v_petrov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_petrov_id);
  perform public.change_task_status(v_task_id, 'in_progress');
  perform public.change_task_status(v_task_id, 'under_review', 'Гидроизоляция и утеплитель готовы, фото по этапам в чате.');

  -- Коттедж: только Иванов -------------------------------------------------------

  -- На проверке после одного круга доработки: в истории виден весь цикл.
  perform pg_temp.act_as(v_manager_id);
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_cottage_id,
    'Монтаж кровли из металлочерепицы',
    'Кровля 180 м²: обрешетка, контробрешетка, гидроветрозащитная мембрана, металлочерепица. Снегозадержатели и водосток по проекту.',
    v_ivanov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_ivanov_id);
  perform public.change_task_status(v_task_id, 'in_progress');
  perform public.change_task_status(v_task_id, 'under_review', 'Кровля готова.');

  perform pg_temp.act_as(v_manager_id);
  perform public.change_task_status(
    v_task_id,
    'needs_revision',
    'Не установлены снегозадержатели над входом и над террасой. Они есть в проекте, лист АР-7.'
  );

  perform pg_temp.act_as(v_ivanov_id);
  perform public.change_task_status(v_task_id, 'in_progress', 'Снегозадержатели привезут в четверг, поставим сразу.');
  perform public.change_task_status(v_task_id, 'under_review', 'Снегозадержатели установлены над входом и над террасой.');

  -- Новая.
  perform pg_temp.act_as(v_manager_id);
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_cottage_id,
    'Утепление фасада минватой 100 мм',
    'Навесной вентилируемый фасад: минвата 100 мм, ветрозащитная мембрана, подсистема под фиброцементные панели. Начать с северной стены.',
    v_ivanov_id
  );

  -- Склад: только Петров ---------------------------------------------------------

  -- Принята.
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_warehouse_id,
    'Заливка бетонного пола, пролет 1',
    'Бетон B25 по щебеночной подготовке, толщина 200 мм, армирование сеткой 150×150. Упрочнение топпингом, нарезка швов на вторые сутки.',
    v_petrov_id
  )
  returning id into v_task_id;

  perform pg_temp.act_as(v_petrov_id);
  perform public.change_task_status(v_task_id, 'in_progress');
  perform public.change_task_status(v_task_id, 'under_review', 'Пол залит, швы нарезаны, акт скрытых работ подписан.');

  perform pg_temp.act_as(v_manager_id);
  perform public.change_task_status(v_task_id, 'accepted');

  -- Новая.
  insert into public.tasks (project_id, title, description, assignee_id)
  values (
    v_warehouse_id,
    'Монтаж секционных ворот (4 шт.)',
    'Ворота 4×4 м с электроприводом на рампе разгрузки. Проемы готовы, ворота привезут во вторник. Перед монтажом проверить отметки пола.',
    v_petrov_id
  );

  raise notice 'Готово: 3 объекта, 8 задач, история статусов записана триггерами.';
end;
$$;
