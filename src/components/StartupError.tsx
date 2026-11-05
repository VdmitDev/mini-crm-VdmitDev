// Этот экран не должен зависеть от Supabase: он показывается как раз тогда,
// когда клиент Supabase создать не удалось.
export function StartupError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Неизвестная ошибка';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">Приложение не запустилось</h1>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <p className="mt-4 text-xs text-slate-500">
          Проверьте переменные окружения (файл .env или настройки хостинга) и обновите страницу.
        </p>
      </div>
    </div>
  );
}
