import { formatDateTime } from '../lib/format';
import { ROLE_LABELS } from '../lib/taskWorkflow';
import type { TaskHistoryItem } from '../types';
import { StatusBadge } from './StatusBadge';

export function TaskHistory({ entries }: { entries: TaskHistoryItem[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Записей пока нет.</p>;
  }

  return (
    <ol className="space-y-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative pl-6">
          <span className="absolute top-1.5 left-0 size-2.5 rounded-full bg-slate-300 ring-4 ring-white" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {entry.from_status ? (
              <>
                <StatusBadge status={entry.from_status} />
                <span className="text-slate-400" aria-label="перешла в">
                  →
                </span>
                <StatusBadge status={entry.to_status} />
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700">Задача создана</span>
                <StatusBadge status={entry.to_status} />
              </>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(entry.created_at)} · {formatActor(entry)}
          </p>

          {entry.comment && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-700 ring-1 ring-slate-200 ring-inset">
              {entry.comment}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatActor(entry: TaskHistoryItem): string {
  // Профиль прежнего исполнителя (если задачу переназначили) политики доступа
  // текущему исполнителю не показывают. Сама запись истории при этом видна.
  if (!entry.actor) return 'другой сотрудник';
  return `${entry.actor.full_name} (${ROLE_LABELS[entry.actor.role].toLowerCase()})`;
}
