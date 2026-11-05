import { NotFoundState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <NotFoundState
      title="Страница не найдена"
      description="Проверьте адрес или вернитесь на главную."
      backTo="/"
      backLabel="На главную"
    />
  );
}
