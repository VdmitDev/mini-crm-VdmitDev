import { cn } from '../lib/classNames';
import { TASK_STATUS_LABELS } from '../lib/taskWorkflow';
import type { TaskStatus } from '../types';

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  under_review: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  needs_revision: 'bg-red-50 text-red-700 ring-red-600/20',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
        className,
      )}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
