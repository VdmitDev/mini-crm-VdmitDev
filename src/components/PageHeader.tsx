import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ссылка «назад» над заголовком. */
  backLink?: { to: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backLink, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backLink && (
        <Link to={backLink.to} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {backLink.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-slate-900">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
