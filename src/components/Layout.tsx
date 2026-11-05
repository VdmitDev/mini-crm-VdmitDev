import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCurrentProfile } from '../context/AuthContext';
import { useSignOut } from '../hooks/useSignOut';
import { cn } from '../lib/classNames';
import { ROLE_LABELS } from '../lib/taskWorkflow';
import { Button } from './ui/Button';

export function Layout() {
  const profile = useCurrentProfile();
  const handleSignOut = useSignOut();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <img src="/favicon.svg" alt="" className="size-7" />
              СтройCRM
            </Link>
            <nav className="flex gap-1" aria-label="Основное меню">
              {/* «Мои задачи» нужны только исполнителю: постановщик работает от объектов. */}
              {profile.role === 'assignee' && <MenuLink to="/my-tasks">Мои задачи</MenuLink>}
              <MenuLink to="/projects">Объекты</MenuLink>
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function MenuLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        )
      }
    >
      {children}
    </NavLink>
  );
}
