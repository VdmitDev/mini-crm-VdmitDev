import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  /** Пока идет сохранение, окно нельзя закрыть Escape или крестиком. */
  isDismissible?: boolean;
  children: ReactNode;
}

/**
 * Модальное окно на нативном <dialog>: фокус, Escape и блокировка фона
 * работают силами браузера. Содержимое монтируется только когда окно открыто,
 * поэтому формы внутри каждый раз открываются чистыми.
 *
 * Клик по фону окно не закрывает намеренно: так легко потерять
 * наполовину заполненную форму.
 */
export function Modal({ isOpen, title, onClose, isDismissible = true, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: браузер закрыл бы окно сам, но состоянием управляем мы.
        event.preventDefault();
        if (isDismissible) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
    >
      {isOpen && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={!isDismissible}
              aria-label="Закрыть"
              className="-m-1 cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
