import { useCallback, useEffect, useState } from 'react';

interface LoadResult<T> {
  /** Для какого загрузчика и какой попытки получен ответ: так понимаем, актуален ли он. */
  loader: () => Promise<T>;
  attempt: number;
  data: T | undefined;
  error: unknown;
}

/**
 * Загружает данные при монтировании, при смене loader и по вызову reload().
 * loader нужно оборачивать в useCallback: от него зависит перезагрузка.
 *
 * isLoading не хранится в состоянии, а вычисляется: ответ есть, но он
 * получен для другого запроса, значит, ждем новый. Ответы устаревших
 * запросов отбрасываются, поэтому быстрый переход между задачами не
 * перепутает данные.
 */
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult<T> | null>(null);

  useEffect(() => {
    let isCurrent = true;

    loader().then(
      (data) => {
        if (isCurrent) setResult({ loader, attempt, data, error: undefined });
      },
      (error: unknown) => {
        if (!isCurrent) return;
        // Если перезагрузка не удалась, оставляем на экране прошлые данные
        // и показываем ошибку рядом с ними.
        setResult((previous) => ({
          loader,
          attempt,
          data: previous?.loader === loader ? previous.data : undefined,
          error,
        }));
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [loader, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  const isSameLoader = result !== null && result.loader === loader;
  const isLoading = !isSameLoader || result.attempt !== attempt;

  return {
    // Во время перезагрузки показываем прошлые данные, чтобы экран не мигал.
    data: isSameLoader ? result.data : undefined,
    error: isSameLoader && !isLoading ? result.error : undefined,
    isLoading,
    reload,
  };
}
