const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const pluralRules = new Intl.PluralRules('ru-RU');

/** «4 ноября 2026 г. в 14:05» */
export function formatDateTime(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate));
}

/** «4 нояб. 2026 г.» */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

/** pluralize(5, ['задача', 'задачи', 'задач']) → «5 задач» */
export function pluralize(count: number, [one, few, many]: [string, string, string]): string {
  const rule = pluralRules.select(count);
  const word = rule === 'one' ? one : rule === 'few' ? few : many;
  return `${count} ${word}`;
}
