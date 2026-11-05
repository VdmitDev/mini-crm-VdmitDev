import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { deleteProject, fetchProjectWithTasks, updateProject } from '../api/projects';
import { createTask } from '../api/tasks';
import { PageHeader } from '../components/PageHeader';
import { ProjectForm } from '../components/ProjectForm';
import { StatusFilter, type StatusFilterValue } from '../components/StatusFilter';
import { TaskForm } from '../components/TaskForm';
import { TaskList } from '../components/TaskList';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { EmptyState, ErrorState, NotFoundState } from '../components/ui/States';
import { useCurrentProfile } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { getErrorMessage } from '../lib/errors';
import { pluralize } from '../lib/format';
import { isUuid } from '../lib/validation';
import type { ProjectFormValues, ProjectWithTasks, TaskFormValues } from '../types';

type OpenDialog = 'edit' | 'delete' | 'create-task' | null;

export function ProjectDetailPage() {
  const { projectId } = useParams();

  // Кривой id в адресе не отправляем в базу, сразу показываем «не найдено».
  if (!isUuid(projectId)) {
    return <ProjectNotFound />;
  }

  // key сбрасывает состояние страницы (фильтр, открытые окна) при переходе к другому объекту.
  return <ProjectDetailContent key={projectId} projectId={projectId} />;
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';
  const navigate = useNavigate();

  const loadProject = useCallback(() => fetchProjectWithTasks(projectId), [projectId]);
  const { data: project, error, isLoading, reload } = useAsyncData(loadProject);

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const closeDialog = () => setOpenDialog(null);

  if (isLoading && project === undefined) return <PageLoader />;
  if (error && project === undefined) return <ErrorState error={error} onRetry={reload} />;
  if (!project) return <ProjectNotFound />;

  // Если задач с выбранным статусом не осталось (например, последнюю приняли),
  // возвращаемся к «Все», иначе пользователь увидит пустой список без активного фильтра.
  const activeFilter: StatusFilterValue =
    statusFilter !== 'all' && project.tasks.some((task) => task.status === statusFilter) ? statusFilter : 'all';
  const visibleTasks =
    activeFilter === 'all' ? project.tasks : project.tasks.filter((task) => task.status === activeFilter);

  async function handleUpdate(values: ProjectFormValues) {
    try {
      await updateProject(projectId, values);
      toast.success('Объект обновлен');
      closeDialog();
      reload();
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    }
  }

  async function handleDelete() {
    try {
      await deleteProject(projectId);
      toast.success('Объект удален');
      navigate('/projects', { replace: true });
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    }
  }

  async function handleCreateTask(values: TaskFormValues) {
    try {
      const task = await createTask(values);
      toast.success('Задача создана');
      closeDialog();
      navigate(`/tasks/${task.id}`);
    } catch (createError) {
      toast.error(getErrorMessage(createError));
    }
  }

  return (
    <>
      <PageHeader
        backLink={{ to: '/projects', label: 'Все объекты' }}
        title={project.name}
        subtitle={project.address}
        actions={
          // Кнопки управления видит только постановщик. RLS все равно не даст
          // исполнителю изменить или удалить объект, даже запросом в обход интерфейса.
          isManager && (
            <>
              <Button variant="secondary" onClick={() => setOpenDialog('edit')}>
                Редактировать
              </Button>
              <Button variant="secondary" onClick={() => setOpenDialog('delete')}>
                Удалить
              </Button>
              <Button onClick={() => setOpenDialog('create-task')}>Новая задача</Button>
            </>
          )
        }
      />

      {error && <ErrorState error={error} onRetry={reload} isCompact />}

      <section aria-labelledby="project-tasks-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="project-tasks-heading" className="text-lg font-semibold text-slate-900">
            {isManager ? 'Задачи' : 'Ваши задачи на объекте'}
          </h2>
          {project.tasks.length > 0 && (
            <StatusFilter
              value={activeFilter}
              onChange={setStatusFilter}
              statuses={project.tasks.map((task) => task.status)}
            />
          )}
        </div>

        {project.tasks.length === 0 ? (
          <EmptyState
            title="Задач пока нет"
            description={isManager ? 'Создайте задачу и назначьте исполнителя.' : undefined}
            action={isManager && <Button onClick={() => setOpenDialog('create-task')}>Новая задача</Button>}
          />
        ) : (
          <TaskList tasks={visibleTasks} showAssignee={isManager} />
        )}

        {!isManager && (
          <p className="mt-3 text-xs text-slate-500">
            Показаны только ваши задачи. Задачи других исполнителей на этом объекте вам не видны.
          </p>
        )}
      </section>

      {isManager && (
        <ManagerDialogs
          project={project}
          openDialog={openDialog}
          onClose={closeDialog}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCreateTask={handleCreateTask}
        />
      )}
    </>
  );
}

interface ManagerDialogsProps {
  project: ProjectWithTasks;
  openDialog: OpenDialog;
  onClose: () => void;
  onUpdate: (values: ProjectFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateTask: (values: TaskFormValues) => Promise<void>;
}

function ManagerDialogs({ project, openDialog, onClose, onUpdate, onDelete, onCreateTask }: ManagerDialogsProps) {
  const taskCount = project.tasks.length;

  return (
    <>
      <Modal isOpen={openDialog === 'edit'} title="Редактирование объекта" onClose={onClose}>
        <ProjectForm
          initialValues={{ name: project.name, address: project.address }}
          submitLabel="Сохранить"
          onSubmit={onUpdate}
          onCancel={onClose}
        />
      </Modal>

      <ConfirmDialog
        isOpen={openDialog === 'delete'}
        title="Удалить объект?"
        confirmLabel="Удалить объект"
        message={
          taskCount > 0 ? (
            <>
              Вместе с объектом «{project.name}» будут удалены{' '}
              <strong>{pluralize(taskCount, ['задача', 'задачи', 'задач'])}</strong> и их история. Отменить это действие
              нельзя.
            </>
          ) : (
            <>Объект «{project.name}» будет удален. Отменить это действие нельзя.</>
          )
        }
        onConfirm={onDelete}
        onClose={onClose}
      />

      <Modal isOpen={openDialog === 'create-task'} title="Новая задача" onClose={onClose}>
        <TaskForm
          initialValues={{ title: '', description: '', project_id: project.id, assignee_id: '' }}
          submitLabel="Создать задачу"
          onSubmit={onCreateTask}
          onCancel={onClose}
        />
      </Modal>
    </>
  );
}

function ProjectNotFound() {
  return (
    <NotFoundState
      title="Объект не найден"
      description="Возможно, его удалили, или у вас нет к нему доступа."
      backTo="/projects"
      backLabel="К списку объектов"
    />
  );
}
