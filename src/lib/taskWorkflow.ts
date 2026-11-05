import type { Profile, StatusTransition, Task, TaskStatus, UserRole } from '../types';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  under_review: 'На проверке',
  needs_revision: 'На доработке',
  accepted: 'Принята',
};

/** Порядок статусов по ходу работы: для фильтров и легенд. */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  'new',
  'in_progress',
  'under_review',
  'needs_revision',
  'accepted',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Постановщик',
  assignee: 'Исполнитель',
};

const TRANSITION_ACTION_LABELS: Partial<Record<`${TaskStatus}->${TaskStatus}`, string>> = {
  'new->in_progress': 'Взять в работу',
  'in_progress->under_review': 'Отправить на проверку',
  'under_review->accepted': 'Принять',
  'under_review->needs_revision': 'Вернуть на доработку',
  'needs_revision->in_progress': 'Взять в доработку',
};

export function getTransitionActionLabel(transition: StatusTransition): string {
  const key = `${transition.from_status}->${transition.to_status}` as const;
  // Если в базу добавят новый переход, кнопка все равно появится с понятной подписью.
  return TRANSITION_ACTION_LABELS[key] ?? `Перевести в «${TASK_STATUS_LABELS[transition.to_status]}»`;
}

/**
 * Какие переходы доступны пользователю прямо сейчас.
 *
 * Правила приходят из таблицы task_status_transitions, той же, по которой
 * проверяет триггер в базе. Здесь мы только решаем, какие кнопки показать:
 * если интерфейс ошибется, база все равно отклонит запрос.
 */
export function getAvailableTransitions(
  task: Pick<Task, 'status' | 'assignee_id'>,
  currentUser: Pick<Profile, 'id' | 'role'>,
  rules: StatusTransition[],
): StatusTransition[] {
  return rules.filter((rule) => {
    if (rule.from_status !== task.status) return false;

    if (rule.allowed_role === 'manager') {
      return currentUser.role === 'manager';
    }

    // 'assignee' в правилах означает не любого исполнителя, а назначенного на эту задачу.
    return currentUser.role === 'assignee' && task.assignee_id === currentUser.id;
  });
}

/** Подсказка вместо кнопок, когда действий нет: чтобы было понятно, чего ждем. */
export function getNoActionsHint(task: Pick<Task, 'status'>, currentUser: Pick<Profile, 'role'>): string {
  if (task.status === 'accepted') {
    return 'Задача принята. Это финальный статус, действий больше не требуется.';
  }

  if (currentUser.role === 'manager') {
    return 'Задача сейчас у исполнителя. Принять работу или вернуть на доработку можно будет, когда он отправит ее на проверку.';
  }

  if (task.status === 'under_review') {
    return 'Работа отправлена на проверку. Ждем решения постановщика.';
  }

  return 'Сейчас по задаче нет доступных вам действий.';
}
