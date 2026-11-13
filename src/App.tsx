import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routes, legacyPaths } from './routes';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import Login from './pages/Login';
import { SubNav } from './components/SubNav';

/** 첫 화면: 로그인했으면 Daily, 아니면 공개된 앱 서랍 */
function Landing() {
  const { session, loading } = useAuth();
  if (loading) return <div className="center muted">불러오는 중…</div>;
  return <Navigate to={session ? '/daily/todo' : '/apps'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            {routes.flatMap((r) => {
              const guard = (el: JSX.Element) => (r.requiresAuth ? <RequireAuth>{el}</RequireAuth> : el);
              if (!r.children) {
                const Page = r.component!;
                return [<Route key={r.path} path={r.path} element={guard(<Page />)} />];
              }
              return [
                <Route key={r.path} path={r.path} element={<Navigate to={r.children[0].path} replace />} />,
                ...r.children.map(({ path, component: Page }) => (
                  <Route key={path} path={path} element={guard(<><SubNav group={r} /><Page /></>)} />
                )),
              ];
            })}
            {Object.entries(legacyPaths).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AuthProvider>
  );
}
