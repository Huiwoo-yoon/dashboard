import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import Login from './pages/Login';

/** 첫 화면: 로그인했으면 Todo, 아니면 공개된 앱 서랍 */
function Landing() {
  const { session, loading } = useAuth();
  if (loading) return <div className="center muted">불러오는 중…</div>;
  return <Navigate to={session ? '/todo' : '/apps'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
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
