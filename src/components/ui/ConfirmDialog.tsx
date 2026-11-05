import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  /** Обработку ошибок (toast) делает вызывающий код: он знает контекст действия. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose} isDismissible={!isSubmitting}>
      <div className="space-y-6">
        <div className="text-sm text-slate-600">{message}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button variant={variant} onClick={handleConfirm} isLoading={isSubmitting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
