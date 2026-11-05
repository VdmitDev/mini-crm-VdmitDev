import { useCallback, useState } from 'react';
import { fetchMyTasks } from '../api/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useCurrentProfile } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import type { TaskListItem, TaskStatus } from '../types';

// Что требует действия исполнителя, показываем первым: сначала возвраты
// на доработку (их ждут), потом новые, потом начатые.
const TODO_PRIORITY: Partial<Record<TaskStatus, number>> = {
  needs_revision: 0,
  new: 1,
  in_progress: 2,
};

export function MyTasksPage() {
  const profile = useCurrentProfile();
  const loadTasks = useCallback(() => fetchMyTasks(profile.id), [profile.id]);
  const { data: tasks, error, isLoading, reload } = useAsyncData(loadTasks);
  const [isAcceptedVisible, setIsAcceptedVisible] = useState(false);

  if (isLoading && !tasks) return <PageLoader />;
  if (error && !tasks) return <ErrorState error={error} onRetry={reload} />;
  if (!tasks) return null;

  const todoTasks = tasks
    .filter((task) => task.status in TODO_PRIORITY)
    .sort((a, b) => (TODO_PRIORITY[a.status] ?? 0) - (TODO_PRIORITY[b.status] ?? 0));
  const reviewTasks = tasks.filter((task) => task.status === 'under_review');
  const acceptedTasks = tasks.filter((task) => task.status === 'accepted');

  return (
    <>
      <PageHeader title="Мои задачи" subtitle="Задачи, назначенные вам, по всем объектам" />

      {error && <ErrorState error={error} onRetry={reload} isCompact />}

      {tasks.length === 0 ? (
        <EmptyState
          title="У вас пока нет задач"
          description="Когда постановщик назначит вам задачу, она появится здесь."
        />
      ) : (
        <div className="space-y-8">
          <TaskGroup
            title="Нужно сделать"
            tasks={todoTasks}
            emptyText="Все задачи выполнены или ждут проверки."
          />
          <TaskGroup title="На проверке у постановщика" tasks={reviewTasks} emptyText="Нет задач на проверке." />

          {acceptedTasks.length > 0 && (
            <section>
              <Button variant="ghost" size="sm" onClick={() => setIsAcceptedVisible((isVisible) => !isVisible)}>
                {isAcceptedVisible ? 'Скрыть принятые' : `Показать принятые (${acceptedTasks.length})`}
              </Button>
              {isAcceptedVisible && (
                <div className="mt-3">
                  <TaskList tasks={acceptedTasks} showProject />
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}

function TaskGroup({ title, tasks, emptyText }: { title: string; tasks: TaskListItem[]; emptyText: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        {title} <span className="text-base font-normal text-slate-400">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        <TaskList tasks={tasks} showProject />
      )}
    </section>
  );
}
