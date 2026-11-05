import { cn } from '../lib/classNames';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '../lib/taskWorkflow';
import type { TaskStatus } from '../types';

export type StatusFilterValue = TaskStatus | 'all';

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  statuses: TaskStatus[];
}

/** Фильтр задач по статусу с количеством в каждом. Пустые статусы не показываем. */
export function StatusFilter({ value, onChange, statuses }: StatusFilterProps) {
  const counts = new Map<TaskStatus, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const options: { value: StatusFilterValue; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: statuses.length },
    ...TASK_STATUS_ORDER.filter((status) => counts.has(status)).map((status) => ({
      value: status,
      label: TASK_STATUS_LABELS[status],
      count: counts.get(status) ?? 0,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по статусу">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors',
              isActive
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
            )}
          >
            {option.label}
            <span className={cn('text-xs', isActive ? 'text-slate-300' : 'text-slate-400')}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
