import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StartupError } from './components/StartupError';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Приложение грузим динамически: если при старте что-то не так (например, не
// заданы переменные окружения или подставлен секретный ключ), покажем понятное
// сообщение вместо белого экрана.
import('./App')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    root.render(<StartupError error={error} />);
  });
