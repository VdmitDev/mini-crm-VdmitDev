/** Склеивает CSS-классы, пропуская пустые значения: cn('a', isActive && 'b'). */
export function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}
