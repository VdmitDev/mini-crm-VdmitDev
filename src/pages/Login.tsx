import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/FormField';
import { FullPageLoader } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // После входа возвращаем туда, куда человек шел (например, по ссылке на задачу).
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (status === 'loading') return <FullPageLoader />;
  if (status !== 'signed_out') return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setFormError('Введите email и пароль.');
      return;
    }

    setFormError(undefined);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // Дальше AuthContext сам загрузит профиль, и страница перенаправит пользователя.
    } catch (error) {
      setFormError(getErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto size-12" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Вход в СтройCRM</h1>
          <p className="mt-1 text-sm text-slate-500">Объекты, задачи и контроль их выполнения</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Войти
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Регистрация закрыта. Учетные записи создает администратор.
        </p>
      </div>
    </div>
  );
}
