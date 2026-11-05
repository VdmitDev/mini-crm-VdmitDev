import { supabase } from '../lib/supabase';
import type {
  StatusTransition,
  Task,
  TaskDetails,
  TaskFormValues,
  TaskHistoryItem,
  TaskListItem,
  TaskStatus,
} from '../types';

const TASK_COLUMNS =
  'id, project_id, title, description, assignee_id, author_id, status, created_at, updated_at';

/** Задачи, назначенные пользователю, по всем объектам (экран «Мои задачи»). */
export async function fetchMyTasks(userId: string): Promise<TaskListItem[]> {
  // RLS и так отдаст исполнителю только его задачи. Явный фильтр по assignee_id
  // делает запрос понятнее и позволяет базе использовать индекс.
  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, title, status, created_at, updated_at, project:projects(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)',
    )
    .eq('assignee_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Карточка задачи. null, если задачи нет или RLS ее не показывает. */
export async function fetchTask(taskId: string): Promise<TaskDetails | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `${TASK_COLUMNS}, project:projects(id, name, address), assignee:profiles!tasks_assignee_id_fkey(id, full_name, role), author:profiles!tasks_author_id_fkey(id, full_name, role)`,
    )
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchTaskHistory(taskId: string): Promise<TaskHistoryItem[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select(
      'id, task_id, changed_by, from_status, to_status, comment, created_at, actor:profiles!task_history_changed_by_fkey(id, full_name, role)',
    )
    .eq('task_id', taskId)
    .order('id', { ascending: true });

  if (error) throw error;
  return data;
}

/** Правила переходов из той же таблицы, по которой проверяет триггер в базе. */
export async function fetchStatusTransitions(): Promise<StatusTransition[]> {
  const { data, error } = await supabase
    .from('task_status_transitions')
    .select('from_status, to_status, allowed_role, requires_comment');

  if (error) throw error;
  return data;
}

export async function createTask(values: TaskFormValues): Promise<Task> {
  // Статус «Новая», автор и даты ставит база: клиент эти колонки передать не может.
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: values.project_id,
      title: values.title.trim(),
      description: values.description.trim(),
      assignee_id: values.assignee_id,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, values: TaskFormValues): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      project_id: values.project_id,
      title: values.title.trim(),
      description: values.description.trim(),
      assignee_id: values.assignee_id,
    })
    .eq('id', taskId)
    .select(TASK_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  // Как и с объектами: без .select() удаление, запрещенное RLS, выглядело бы успешным.
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id');

  if (error) throw error;
  if (data.length === 0) {
    throw new Error('Задача не удалена: она не найдена или у вас нет прав на удаление.');
  }
}

/**
 * Смена статуса идет через RPC, чтобы вместе со статусом передать комментарий.
 * Все проверки (кто, из какого статуса в какой, нужен ли комментарий) делает база.
 */
export async function changeTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  comment: string | null,
): Promise<Task> {
  const { data, error } = await supabase.rpc('change_task_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment ?? undefined,
  });

  if (error) throw error;
  return data;
}
