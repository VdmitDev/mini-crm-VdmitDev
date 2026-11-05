import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/classNames';

interface FieldWrapperProps {
  id: string;
  label: string;
  isRequired?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

const CONTROL_CLASSES =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const INVALID_CLASSES = 'ring-red-400 focus:ring-red-500';

function FieldWrapper({ id, label, isRequired, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {isRequired && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextField({ label, error, hint, id, required, className, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper id={inputId} label={label} isRequired={required} error={error} hint={hint}>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-message` : undefined}
        className={cn(CONTROL_CLASSES, error && INVALID_CLASSES, className)}
        {...inputProps}
      />
    </FieldWrapper>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextAreaField({ label, error, hint, id, required, className, ...textareaProps }: TextAreaFieldProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <FieldWrapper id={textareaId} label={label} isRequired={required} error={error} hint={hint}>
      <textarea
        id={textareaId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${textareaId}-message` : undefined}
        className={cn(CONTROL_CLASSES, 'min-h-24 resize-y', error && INVALID_CLASSES, className)}
        {...textareaProps}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function SelectField({ label, error, hint, id, required, className, children, ...selectProps }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldWrapper id={selectId} label={label} isRequired={required} error={error} hint={hint}>
      <select
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${selectId}-message` : undefined}
        className={cn(CONTROL_CLASSES, 'pr-8', error && INVALID_CLASSES, className)}
        {...selectProps}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
