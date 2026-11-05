import { useState, type FormEvent } from 'react';
import { LIMITS, validateRequiredText } from '../lib/validation';
import type { ProjectFormValues } from '../types';
import { Button } from './ui/Button';
import { TextField } from './ui/FormField';

interface ProjectFormProps {
  initialValues?: ProjectFormValues;
  submitLabel: string;
  /** Ошибки сохранения обрабатывает вызывающий код (toast), форма при этом остается открытой. */
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onCancel: () => void;
}

type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

export function ProjectForm({ initialValues, submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues ?? { name: '', address: '' });
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof ProjectFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors: ProjectFormErrors = {
      name: validateRequiredText(values.name, LIMITS.projectName),
      address: validateRequiredText(values.address, LIMITS.projectAddress),
    };
    if (validationErrors.name || validationErrors.address) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <TextField
        label="Название"
        required
        placeholder="Например: ЖК «Северный парк», корпус 2"
        value={values.name}
        maxLength={LIMITS.projectName}
        error={errors.name}
        autoFocus
        onChange={(event) => updateField('name', event.target.value)}
      />
      <TextField
        label="Адрес"
        required
        placeholder="Город, улица, дом"
        value={values.address}
        maxLength={LIMITS.projectAddress}
        error={errors.address}
        onChange={(event) => updateField('address', event.target.value)}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
