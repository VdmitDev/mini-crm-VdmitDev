import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createProject, fetchProjects } from '../api/projects';
import { PageHeader } from '../components/PageHeader';
import { ProjectForm } from '../components/ProjectForm';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useCurrentProfile } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { getErrorMessage } from '../lib/errors';
import { pluralize } from '../lib/format';
import { TASK_STATUS_ORDER } from '../lib/taskWorkflow';
import type { ProjectFormValues, ProjectListItem, TaskStatus } from '../types';

export function ProjectsPage() {
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';
  const navigate = useNavigate();

  const { data: projects, error, isLoading, reload } = useAsyncData(fetchProjects);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function handleCreate(values: ProjectFormValues) {
    try {
      const project = await createProject(values);
      toast.success('Объект создан');
      setIsCreateOpen(false);
      navigate(`/projects/${project.id}`);
    } catch (createError) {
      toast.error(getErrorMessage(createError));
    }
  }

  let content: ReactNode;
  if (isLoading && !projects) {
    content = <PageLoader />;
  } else if (!projects) {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (projects.length === 0) {
    content = (
      <EmptyState
        title={isManager ? 'Объектов пока нет' : 'У вас пока нет задач'}
        description={
          isManager
            ? 'Добавьте первый объект, затем создайте по нему задачи для исполнителей.'
            : 'Объект появится здесь, как только постановщик назначит вам задачу на нем.'
        }
        action={isManager && <Button onClick={() => setIsCreateOpen(true)}>Добавить объект</Button>}
      />
    );
  } else {
    content = (
      <>
        {error && <ErrorState error={error} onRetry={reload} isCompact />}
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} isManager={isManager} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Объекты"
        subtitle={isManager ? 'Все стройки компании' : 'Объекты, где у вас есть задачи'}
        actions={
          // Кнопку видит только постановщик. Даже если исполнитель отправит запрос
          // на создание вручную, база отклонит его по RLS.
          isManager && <Button onClick={() => setIsCreateOpen(true)}>Добавить объект</Button>
        }
      />

      {content}

      <Modal isOpen={isCreateOpen} title="Новый объект" onClose={() => setIsCreateOpen(false)}>
        <ProjectForm submitLabel="Создать объект" onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
      </Modal>
    </>
  );
}

function ProjectCard({ project, isManager }: { project: ProjectListItem; isManager: boolean }) {
  const statusCounts = countByStatus(project.tasks.map((task) => task.status));
  const taskWord = pluralize(project.tasks.length, ['задача', 'задачи', 'задач']);

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <h2 className="font-semibold text-slate-900">{project.name}</h2>
      <p className="mt-1 text-sm text-slate-500">{project.address}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <span className="mr-1 text-sm text-slate-600">{isManager ? taskWord : `Ваши: ${taskWord}`}</span>
        {TASK_STATUS_ORDER.filter((status) => statusCounts[status] > 0).map((status) => (
          <span key={status} className="inline-flex items-center gap-1">
            <StatusBadge status={status} />
            <span className="text-xs text-slate-500">{statusCounts[status]}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

function countByStatus(statuses: TaskStatus[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    new: 0,
    in_progress: 0,
    under_review: 0,
    needs_revision: 0,
    accepted: 0,
  };
  for (const status of statuses) counts[status] += 1;
  return counts;
}
