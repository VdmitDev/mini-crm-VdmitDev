import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

/**
 * Выход по кнопке. Переход на /login делает RequireAuth, когда сессия
 * закончится; здесь только сообщаем об ошибке, если выйти не удалось
 * (например, пропала сеть).
 */
export function useSignOut() {
  const { signOut } = useAuth();

  return useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [signOut]);
}
