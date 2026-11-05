// Лимиты совпадают с CHECK-ограничениями в БД (supabase/migrations/001_init.sql).
// Здесь они нужны, чтобы показать ошибку сразу у поля, а не после запроса.
export const LIMITS = {
  projectName: 200,
  projectAddress: 300,
  taskTitle: 200,
  taskDescription: 5000,
  statusComment: 2000,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Идентификатор из адресной строки: проверяем формат до запроса в базу. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/** Текст ошибки для обязательного текстового поля или undefined, если все в порядке. */
export function validateRequiredText(value: string, maxLength: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Заполните поле';
  if (trimmed.length > maxLength) return `Не длиннее ${maxLength} символов`;
  return undefined;
}
