import { supabase } from '../lib/supabase';
import type { Profile, ProfileSummary } from '../types';

/** Профиль текущего пользователя или null, если администратор его еще не создал. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Исполнители для выбора в форме задачи. Список целиком видит только постановщик (RLS). */
export async function fetchAssignees(): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'assignee')
    .order('full_name');

  if (error) throw error;
  return data;
}
