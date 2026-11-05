import { supabase } from '../lib/supabase';
import type { Project, ProjectFormValues, ProjectListItem, ProjectWithTasks } from '../types';

const PROJECT_COLUMNS = 'id, name, address, created_by, created_at, updated_at';

/**
 * Список объектов. Фильтровать по пользователю не нужно: RLS сам вернет
 * постановщику все объекты, а исполнителю только те, где у него есть задачи.
 */
export async function fetchProjects(): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, address, created_at, tasks(status)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Короткий список для выпадающего меню в форме задачи. */
export async function fetchProjectOptions(): Promise<Pick<Project, 'id' | 'name'>[]> {
  const { data, error } = await supabase.from('projects').select('id, name').order('name');

  if (error) throw error;
  return data;
}

/** Объект вместе с задачами. null, если объекта нет или RLS его не показывает. */
export async function fetchProjectWithTasks(projectId: string): Promise<ProjectWithTasks | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      `${PROJECT_COLUMNS}, tasks(id, title, status, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, full_name, role))`,
    )
    .eq('id', projectId)
    .order('created_at', { referencedTable: 'tasks', ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProject(values: ProjectFormValues): Promise<Project> {
  // created_by и даты проставляет база, клиент их передать и не может (права на колонки).
  const { data, error } = await supabase
    .from('projects')
    .insert({ name: values.name.trim(), address: values.address.trim() })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(projectId: string, values: ProjectFormValues): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ name: values.name.trim(), address: values.address.trim() })
    .eq('id', projectId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  // Если RLS не пустит, Supabase не вернет ошибку, а просто ничего не удалит.
  // Поэтому просим вернуть удаленные строки и проверяем, что удаление было.
  const { data, error } = await supabase.from('projects').delete().eq('id', projectId).select('id');

  if (error) throw error;
  if (data.length === 0) {
    throw new Error('Объект не удален: он не найден или у вас нет прав на удаление.');
  }
}
