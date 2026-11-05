import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { changeTaskStatus } from '../api/tasks';
import { useCurrentProfile } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';
import {
  getAvailableTransitions,
  getNoActionsHint,
  getTransitionActionLabel,
  TASK_STATUS_LABELS,
} from '../lib/taskWorkflow';
import { LIMITS } from '../lib/validation';
import type { StatusTransition, Task } from '../types';
import { Button } from './ui/Button';
import { TextAreaField } from './ui/FormField';
import { Modal } from './ui/Modal';

/**
 * Кнопки смены статуса. Родитель рендерит компонент с key={task.status}: если
 * статус поменялся (в том числе кем-то другим), выбранное ранее действие
 * сбрасывается вместе с открытым окном.
 */
interface TaskStatusActionsProps {
  task: Pick<Task, 'id' | 'status' | 'assignee_id'>;
  transitions: StatusTransition[];
  /** Перезагрузить карточку: после смены статуса или если база отклонила действие. */
  onReload: () => void;
}

export function TaskStatusActions({ task, transitions, onReload }: TaskStatusActionsProps) {
  const profile = useCurrentProfile();
  const [selectedTransition, setSelectedTransition] = useState<StatusTransition | null>(null);

  // Показываем только разрешенные текущему пользователю переходы. Это удобство,
  // а не защита: запрос с запрещенным переходом все равно отклонит триггер в базе.
  const availableTransitions = getAvailableTransitions(task, profile, transitions);

  if (availableTransitions.length === 0) {
    return <p className="text-sm text-slate-500">{getNoActionsHint(task, profile)}</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {availableTransitions.map((transition) => (
          <Button
            key={transition.to_status}
            variant={getActionVariant(transition)}
            onClick={() => setSelectedTransition(transition)}
          >
            {getTransitionActionLabel(transition)}
          </Button>
        ))}
      </div>

      <Modal
        isOpen={selectedTransition !== null}
        title={selectedTransition ? getTransitionActionLabel(selectedTransition) : ''}
        onClose={() => setSelectedTransition(null)}
      >
        {selectedTransition && (
          <StatusChangeForm
            taskId={task.id}
            transition={selectedTransition}
            onCancel={() => setSelectedTransition(null)}
            onChanged={() => {
              setSelectedTransition(null);
              onReload();
            }}
            onFailed={onReload}
          />
        )}
      </Modal>
    </>
  );
}

function getActionVariant(transition: StatusTransition) {
  if (transition.to_status === 'accepted') return 'success';
  if (transition.to_status === 'needs_revision') return 'danger';
  return 'primary';
}

interface StatusChangeFormProps {
  taskId: string;
  transition: StatusTransition;
  onCancel: () => void;
  onChanged: () => void;
  onFailed: () => void;
}

function StatusChangeForm({ taskId, transition, onCancel, onChanged, onFailed }: StatusChangeFormProps) {
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCommentRequired = transition.requires_comment;
  const toLabel = TASK_STATUS_LABELS[transition.to_status];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedComment = comment.trim();
    if (isCommentRequired && !trimmedComment) {
      setCommentError('Без комментария вернуть задачу нельзя: опишите, что нужно исправить.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changeTaskStatus(taskId, transition.to_status, trimmedComment || null);
      toast.success(`Статус изменен: «${toLabel}»`);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
      // Статус мог поменять кто-то другой. Перезагружаем карточку: если статус
      // действительно другой, окно закроется само (см. key у компонента); если это
      // был сбой сети, текст комментария останется, и действие можно повторить.
      onFailed();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-slate-600">
        Статус изменится: <strong>«{TASK_STATUS_LABELS[transition.from_status]}»</strong> →{' '}
        <strong>«{toLabel}»</strong>.
        {transition.to_status === 'accepted' && ' Это финальный статус, вернуть задачу в работу будет нельзя.'}
      </p>

      <TextAreaField
        label={isCommentRequired ? 'Что нужно исправить' : 'Комментарий'}
        required={isCommentRequired}
        hint={isCommentRequired ? 'Исполнитель увидит этот текст в карточке задачи.' : 'Необязательно. Попадет в историю задачи.'}
        placeholder={isCommentRequired ? 'Например: не заделаны монтажные швы на окнах кв. 51 и 53' : ''}
        value={comment}
        maxLength={LIMITS.statusComment}
        error={commentError}
        autoFocus
        onChange={(event) => {
          setComment(event.target.value);
          if (commentError) setCommentError(undefined);
        }}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" variant={getActionVariant(transition)} isLoading={isSubmitting}>
          {getTransitionActionLabel(transition)}
        </Button>
      </div>
    </form>
  );
}
