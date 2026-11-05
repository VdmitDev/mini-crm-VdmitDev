import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSignOut } from '../hooks/useSignOut';
import { getErrorMessage } from '../lib/errors';
import type { UserRole } from '../types';
import { Button } from './ui/Button';
import { FullPageLoader } from './ui/Spinner';

/**
 * Пускает на страницу только вошедшего сотрудника с ролью. Это защита
 * интерфейса, а не данных: данные защищает RLS в базе.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, isSignedOutByUser } = useAuth();
  const location = useLocation();

  switch (status) {
    case 'loading':
      return <FullPageLoader />;
    case 'signed_out':
      // Адрес возврата запоминаем, если человек открыл ссылку без входа или у него
      // истекла сессия. После выхода по кнопке не запоминаем: иначе следующий
      // человек за этим компьютером попал бы на страницу предыдущего.
      return (
        <Navigate to="/login" replace state={isSignedOutByUser ? undefined : { from: location.pathname }} />
      );
    case 'no_profile':
      return <NoProfileScreen />;
    case 'profile_error':
      return <ProfileErrorScreen />;
    case 'ready':
      return children;
  }
}

/** Страница только для определенной роли. Остальных отправляем на главную. */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { profile } = useAuth();

  if (profile?.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function SignOutButton() {
  const handleSignOut = useSignOut();

  return (
    <Button variant="secondary" onClick={handleSignOut}>
      Выйти
    </Button>
  );
}

/**
 * Пользователь вошел, но у него нет профиля с ролью. Такое бывает, если
 * администратор создал учетную запись, но не назначил роль. База в этом
 * случае все равно не отдаст ему никаких данных.
 */
function NoProfileScreen() {
  return (
    <CenteredCard>
      <h1 className="text-lg font-semibold text-slate-900">Учетная запись не активирована</h1>
      <p className="mt-2 text-sm text-slate-600">
        Вам еще не назначена роль в системе. Обратитесь к администратору, чтобы он добавил вас как постановщика или
        исполнителя.
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </CenteredCard>
  );
}

function ProfileErrorScreen() {
  const { profileError, retryProfileLoading } = useAuth();

  return (
    <CenteredCard>
      <h1 className="text-lg font-semibold text-slate-900">Не удалось загрузить профиль</h1>
      <p className="mt-2 text-sm text-slate-600">{getErrorMessage(profileError)}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={retryProfileLoading}>Попробовать еще раз</Button>
        <SignOutButton />
      </div>
    </CenteredCard>
  );
}
