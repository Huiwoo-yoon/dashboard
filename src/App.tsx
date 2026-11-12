import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { AuthProvider } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import Login from './pages/Login';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Layout>
          <Routes>
            {routes.map(({ path, component: Page, requiresAuth }) => (
              <Route
                key={path}
                path={path}
                element={requiresAuth ? <RequireAuth><Page /></RequireAuth> : <Page />}
              />
            ))}
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AuthProvider>
  );
}
