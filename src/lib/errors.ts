import { isAuthError } from '@supabase/supabase-js';

interface ApiErrorLike {
  code?: string;
  message: string;
}

const CYRILLIC = /[а-яё]/i;

const NETWORK_ERROR_MESSAGE = 'Нет связи с сервером. Проверьте интернет и попробуйте еще раз.';

/**
 * Превращает любую ошибку Supabase (Auth, PostgREST, сеть) в понятный
 * пользователю текст для toast-уведомления или формы.
 */
export function getErrorMessage(error: unknown): string {
  if (isAuthError(error)) {
    return getAuthErrorMessage(error.code, error.status, error.message);
  }

  if (isApiErrorLike(error)) {
    if (isNetworkFailure(error.message)) {
      return NETWORK_ERROR_MESSAGE;
    }

    // Ошибки из наших триггеров и RPC уже написаны по-русски и объясняют,
    // что именно запрещено. Показываем их как есть.
    if (CYRILLIC.test(error.message)) {
      return error.message;
    }

    switch (error.code) {
      case 'PGRST116':
        return 'Запись не найдена или у вас нет к ней доступа.';
      case '42501':
        return 'Недостаточно прав для этого действия.';
      case '23503':
        return 'Связанная запись не найдена. Возможно, ее только что удалили.';
      case '23514':
        return 'Данные не прошли проверку. Проверьте, что поля заполнены и не слишком длинные.';
      case '22P02':
        return 'Некорректный идентификатор записи.';
      case 'PGRST301':
      case 'PGRST303':
        return 'Сессия истекла. Обновите страницу и войдите снова.';
    }
  }

  console.error('Необработанная ошибка:', error);
  return 'Что-то пошло не так. Попробуйте еще раз.';
}

function getAuthErrorMessage(code: string | undefined, status: number | undefined, message: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Неверный email или пароль.';
    case 'email_not_confirmed':
      return 'Email не подтвержден. Обратитесь к администратору.';
    case 'user_banned':
      return 'Учетная запись заблокирована. Обратитесь к администратору.';
    case 'over_request_rate_limit':
      return 'Слишком много попыток входа. Подождите минуту и попробуйте снова.';
  }

  if (status === 0 || isNetworkFailure(message)) {
    return NETWORK_ERROR_MESSAGE;
  }

  // Старые версии Auth не присылают code, только текст.
  if (message === 'Invalid login credentials') {
    return 'Неверный email или пароль.';
  }

  console.error('Ошибка авторизации:', code, message);
  return 'Не удалось войти. Попробуйте еще раз.';
}

function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

function isNetworkFailure(message: string): boolean {
  // Тексты разных браузеров: Chrome, Firefox, Safari.
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message);
}
