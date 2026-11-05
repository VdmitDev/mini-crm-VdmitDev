import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../lib/errors';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
  /** Компактная плашка над уже загруженными данными (если не удалось обновить). */
  isCompact?: boolean;
}

export function ErrorState({ error, onRetry, isCompact = false }: ErrorStateProps) {
  const message = getErrorMessage(error);

  if (isCompact) {
    return (
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        <span>Не удалось обновить данные: {message}</span>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="font-medium text-red-800">Не удалось загрузить данные</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>
        Попробовать еще раз
      </Button>
    </div>
  );
}

interface NotFoundStateProps {
  title: string;
  description?: string;
  backTo: string;
  backLabel: string;
}

/** «Не найдено» и «нет доступа» для пользователя выглядят одинаково: RLS просто не отдает чужие записи. */
export function NotFoundState({ title, description, backTo, backLabel }: NotFoundStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Link to={backTo} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          ← {backLabel}
        </Link>
      }
    />
  );
}
