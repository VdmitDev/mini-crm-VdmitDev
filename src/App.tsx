import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { RequireAuth, RequireRole } from './components/RequireAuth';
import { AuthProvider, useCurrentProfile } from './context/AuthContext';
import { LoginPage } from './pages/Login';
import { MyTasksPage } from './pages/MyTasks';
import { NotFoundPage } from './pages/NotFound';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { TaskDetailPage } from './pages/TaskDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<HomeRedirect />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route
              path="my-tasks"
              element={
                <RequireRole role="assignee">
                  <MyTasksPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}

/** Стартовая страница зависит от роли: исполнителю важнее его задачи, постановщику объекты. */
function HomeRedirect() {
  const profile = useCurrentProfile();
  return <Navigate to={profile.role === 'assignee' ? '/my-tasks' : '/projects'} replace />;
}
