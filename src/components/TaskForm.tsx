import { useCallback, useState, type FormEvent } from 'react';
import { fetchAssignees } from '../api/profiles';
import { fetchProjectOptions } from '../api/projects';
import { useAsyncData } from '../hooks/useAsyncData';
import { LIMITS, validateRequiredText } from '../lib/validation';
import type { TaskFormValues } from '../types';
import { Button } from './ui/Button';
import { SelectField, TextAreaField, TextField } from './ui/FormField';
import { PageLoader } from './ui/Spinner';
import { ErrorState } from './ui/States';

interface TaskFormProps {
  initialValues: TaskFormValues;
  submitLabel: string;
  /** Ошибки сохранения обрабатывает вызывающий код (toast), форма при этом остается открытой. */
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onCancel: () => void;
}

type TaskFormErrors = Partial<Record<keyof TaskFormValues, string>>;

export function TaskForm({ initialValues, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const loadOptions = useCallback(
    () => Promise.all([fetchAssignees(), fetchProjectOptions()]).then(([assignees, projects]) => ({ assignees, projects })),
    [],
  );
  const { data: options, error: optionsError, isLoading, reload } = useAsyncData(loadOptions);

  const [values, setValues] = useState<TaskFormValues>(initialValues);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof TaskFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors: TaskFormErrors = {
      title: validateRequiredText(values.title, LIMITS.taskTitle),
      description:
        values.description.trim().length > LIMITS.taskDescription
          ? `Не длиннее ${LIMITS.taskDescription} символов`
          : undefined,
      project_id: values.project_id ? undefined : 'Выберите объект',
      assignee_id: values.assignee_id ? undefined : 'Выберите исполнителя',
    };
    if (Object.values(validationErrors).some(Boolean)) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !options) return <PageLoader label="Загружаем исполнителей и объекты..." />;
  if (optionsError && !options) return <ErrorState error={optionsError} onRetry={reload} />;
  if (!options) return null;

  const hasNoAssignees = options.assignees.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <TextField
        label="Название"
        required
        placeholder="Что нужно сделать"
        value={values.title}
        maxLength={LIMITS.taskTitle}
        error={errors.title}
        autoFocus
        onChange={(event) => updateField('title', event.target.value)}
      />

      <TextAreaField
        label="Описание"
        placeholder="Объем работ, требования, ссылки на чертежи"
        rows={4}
        value={values.description}
        maxLength={LIMITS.taskDescription}
        error={errors.description}
        onChange={(event) => updateField('description', event.target.value)}
      />

      <SelectField
        label="Объект"
        required
        value={values.project_id}
        error={errors.project_id}
        onChange={(event) => updateField('project_id', event.target.value)}
      >
        <option value="">Выберите объект</option>
        {options.projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Исполнитель"
        required
        value={values.assignee_id}
        error={errors.assignee_id}
        disabled={hasNoAssignees}
        hint={
          hasNoAssignees
            ? 'В системе нет сотрудников с ролью «Исполнитель». Их добавляет администратор в Supabase.'
            : 'Сменить исполнителя можно и позже: прежний сразу потеряет доступ к задаче.'
        }
        onChange={(event) => updateField('assignee_id', event.target.value)}
      >
        <option value="">Выберите исполнителя</option>
        {options.assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.full_name}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={hasNoAssignees}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
