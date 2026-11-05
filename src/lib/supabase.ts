import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Скопируйте .env.example в .env и заполните значения.',
  );
}

assertPublicKey(supabaseKey);

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Вход только по email и паролю, ссылок с токенами в адресе у нас нет.
    detectSessionInUrl: false,
  },
});

/**
 * Страховка от ошибки конфигурации. Секретный ключ (service_role / sb_secret_)
 * обходит RLS и дает полный доступ к базе, поэтому в браузере ему не место.
 *
 * Важно понимать границы этой проверки: если ключ подставили в VITE_-переменную,
 * он уже попал в сборку, и его нужно перевыпустить. Проверка нужна, чтобы такая
 * ошибка сразу ломала запуск и была замечена на первом же деплое, а не тихо
 * работала, пока кто-нибудь не найдет ключ в коде страницы.
 */
function assertPublicKey(key: string): void {
  const secretKeyError = new Error(
    'В VITE_SUPABASE_ANON_KEY указан секретный ключ (service_role). Во фронтенде допустим только публичный anon/publishable ключ.',
  );

  if (key.startsWith('sb_secret_')) {
    throw secretKeyError;
  }

  // Старые ключи Supabase это JWT: роль записана в его средней части.
  const [, payload] = key.split('.');
  if (!payload) return;

  let role: unknown;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    role = (JSON.parse(json) as { role?: unknown }).role;
  } catch {
    return; // Не JWT, значит и не service_role.
  }

  if (role === 'service_role') {
    throw secretKeyError;
  }
}
