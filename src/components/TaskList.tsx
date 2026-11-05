import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format';
import type { TaskListItem } from '../types';
import { StatusBadge } from './StatusBadge';

interface TaskListProps {
  tasks: TaskListItem[];
  showProject?: boolean;
  showAssignee?: boolean;
}

export function TaskList({ tasks, showProject = false, showAssignee = false }: TaskListProps) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            to={`/tasks/${task.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <div className="min-w-0">
              {/* Название не обрезаем: на телефоне прорабу важно видеть его целиком. */}
              <p className="font-medium break-words text-slate-900">{task.title}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {[
                  showProject && task.project?.name,
                  showAssignee && (task.assignee?.full_name ?? 'Исполнитель не указан'),
                  `создана ${formatDate(task.created_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <StatusBadge status={task.status} className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
