// Доменные типы приложения.
// Поля названы так же, как колонки в БД (snake_case): данные из Supabase
// используем как есть, без лишнего слоя преобразований.

export type UserRole = 'manager' | 'assignee';

export type TaskStatus = 'new' | 'in_progress' | 'under_review' | 'needs_revision' | 'accepted';

/** Сотрудник (таблица profiles). В тексте ТЗ это «пользователь» с ролью. */
export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

/** Минимум данных о сотруднике для подписей и выпадающих списков. */
export type ProfileSummary = Pick<Profile, 'id' | 'full_name' | 'role'>;

/** Объект (стройка). */
export interface Project {
  id: string;
  name: string;
  address: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_id: string;
  author_id: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

/** Правило перехода из таблицы task_status_transitions. */
export interface StatusTransition {
  from_status: TaskStatus;
  to_status: TaskStatus;
  /** 'manager': любой постановщик; 'assignee': только исполнитель этой задачи. */
  allowed_role: UserRole;
  requires_comment: boolean;
}

export interface TaskHistoryEntry {
  id: number;
  task_id: string;
  changed_by: string;
  /** null у первой записи: задачу только что создали. */
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  created_at: string;
}

// --- Составные типы для экранов ---------------------------------------------

export interface ProjectListItem extends Pick<Project, 'id' | 'name' | 'address' | 'created_at'> {
  /** Статусы задач объекта. Исполнитель получает только свои задачи (так решает RLS). */
  tasks: Pick<Task, 'status'>[];
}

export interface TaskListItem extends Pick<Task, 'id' | 'title' | 'status' | 'created_at' | 'updated_at'> {
  assignee: ProfileSummary | null;
  /** Есть в общем списке задач, нет внутри карточки объекта. */
  project?: Pick<Project, 'id' | 'name'> | null;
}

export interface ProjectWithTasks extends Project {
  tasks: TaskListItem[];
}

export interface TaskDetails extends Task {
  project: Pick<Project, 'id' | 'name' | 'address'> | null;
  assignee: ProfileSummary | null;
  author: ProfileSummary | null;
}

export interface TaskHistoryItem extends TaskHistoryEntry {
  /** null, если политики доступа скрывают профиль автора записи (например, прежнего исполнителя). */
  actor: ProfileSummary | null;
}

// --- Данные форм ---------------------------------------------------------------

export interface ProjectFormValues {
  name: string;
  address: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  project_id: string;
  assignee_id: string;
}
