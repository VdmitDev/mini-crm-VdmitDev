import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { deleteTask, fetchStatusTransitions, fetchTask, fetchTaskHistory, updateTask } from '../api/tasks';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TaskForm } from '../components/TaskForm';
import { TaskHistory } from '../components/TaskHistory';
import { TaskStatusActions } from '../components/TaskStatusActions';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { ErrorState, NotFoundState } from '../components/ui/States';
import { useCurrentProfile } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { cn } from '../lib/classNames';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { isUuid } from '../lib/validation';
import type { StatusTransition, TaskDetails, TaskFormValues, TaskHistoryItem } from '../types';

interface TaskPageData {
  task: TaskDetails | null;
  history: TaskHistoryItem[];
  transitions: StatusTransition[];
}

async function loadTaskPageData(taskId: string): Promise<TaskPageData> {
  const [task, history, transitions] = await Promise.all([
    fetchTask(taskId),
    fetchTaskHistory(taskId),
    fetchStatusTransitions(),
  ]);
  return { task, history, transitions };
}

export function TaskDetailPage() {
  const { taskId } = useParams();

  if (!isUuid(taskId)) {
    return <TaskNotFound />;
  }

  return <TaskDetailContent key={taskId} taskId={taskId} />;
}

function TaskDetailContent({ taskId }: { taskId: string }) {
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';
  const navigate = useNavigate();

  const loadData = useCallback(() => loadTaskPageData(taskId), [taskId]);
  const { data, error, isLoading, reload } = useAsyncData(loadData);

  const [openDialog, setOpenDialog] = useState<'edit' | 'delete' | null>(null);
  const closeDialog = () => setOpenDialog(null);

  if (isLoading && !data) return <PageLoader />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.task) return <TaskNotFound />;

  const { task, history, transitions } = data;

  // Если задачу вернули на доработку, исполнителю важнее всего увидеть, что
  // исправить. Берем последний комментарий постановщика из истории.
  const revisionNote =
    task.status === 'needs_revision'
      ? history.findLast((entry) => entry.to_status === 'needs_revision' && entry.comment)
      : undefined;

  async function handleUpdate(values: TaskFormValues) {
    try {
      await updateTask(taskId, values);
      toast.success('Задача обновлена');
      closeDialog();
      reload();
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    }
  }

  async function handleDelete() {
    try {
      await deleteTask(taskId);
      toast.success('Задача удалена');
      navigate(task.project ? `/projects/${task.project.id}` : '/projects', { replace: true });
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <PageHeader
        backLink={
          task.project
            ? { to: `/projects/${task.project.id}`, label: task.project.name }
            : { to: '/projects', label: 'Все объекты' }
        }
        title={task.title}
        subtitle={<StatusBadge status={task.status} className="text-sm" />}
        actions={
          // Редактирование и удаление только для постановщика. RLS и триггеры
          // в базе все равно не дадут исполнителю изменить что-то кроме статуса.
          isManager && (
            <>
              <Button variant="secondary" onClick={() => setOpenDialog('edit')}>
                Редактировать
              </Button>
              <Button variant="secondary" onClick={() => setOpenDialog('delete')}>
                Удалить
              </Button>
            </>
          )
        }
      />

      {error && <ErrorState error={error} onRetry={reload} isCompact />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {revisionNote && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="note">
              <p className="text-sm font-medium text-red-800">Задачу вернули на доработку</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-red-700">{revisionNote.comment}</p>
            </div>
          )}

          <Card title="Действия">
            <TaskStatusActions key={task.status} task={task} transitions={transitions} onReload={reload} />
          </Card>

          <Card title="Описание">
            {task.description ? (
              <p className="text-sm whitespace-pre-wrap text-slate-700">{task.description}</p>
            ) : (
              <p className="text-sm text-slate-400">Описание не заполнено.</p>
            )}
          </Card>

          <Card title="История">
            <TaskHistory entries={history} />
          </Card>
        </div>

        <Card title="Детали" className="h-fit">
          <dl className="space-y-4 text-sm">
            <DetailRow label="Объект">
              {task.project ? (
                <Link to={`/projects/${task.project.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                  {task.project.name}
                </Link>
              ) : (
                'Не указан'
              )}
              {task.project && <p className="mt-0.5 text-slate-500">{task.project.address}</p>}
            </DetailRow>
            <DetailRow label="Исполнитель">{task.assignee?.full_name ?? 'Не указан'}</DetailRow>
            <DetailRow label="Автор">{task.author?.full_name ?? 'Не указан'}</DetailRow>
            <DetailRow label="Создана">{formatDateTime(task.created_at)}</DetailRow>
            <DetailRow label="Обновлена">{formatDateTime(task.updated_at)}</DetailRow>
          </dl>
        </Card>
      </div>

      {isManager && (
        <>
          <Modal isOpen={openDialog === 'edit'} title="Редактирование задачи" onClose={closeDialog}>
            <TaskForm
              initialValues={{
                title: task.title,
                description: task.description,
                project_id: task.project_id,
                assignee_id: task.assignee_id,
              }}
              submitLabel="Сохранить"
              onSubmit={handleUpdate}
              onCancel={closeDialog}
            />
          </Modal>

          <ConfirmDialog
            isOpen={openDialog === 'delete'}
            title="Удалить задачу?"
            confirmLabel="Удалить задачу"
            message={<>Задача «{task.title}» будет удалена вместе с историей. Отменить это действие нельзя.</>}
            onConfirm={handleDelete}
            onClose={closeDialog}
          />
        </>
      )}
    </>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}

function TaskNotFound() {
  return (
    <NotFoundState
      title="Задача не найдена"
      description="Возможно, ее удалили или назначили другому исполнителю, или у вас нет к ней доступа."
      backTo="/"
      backLabel="На главную"
    />
  );
}
