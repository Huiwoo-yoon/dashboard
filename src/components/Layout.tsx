import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { routes } from '../routes';
import { useAuth } from './AuthProvider';
import { signOut } from '../api/auth';
import { Icon } from './Icon';

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">D</span>
      <span className="brand-text">
        <strong>DASHBOARD</strong>
        <small>PERSONAL</small>
      </span>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const logout = () => signOut().then(() => navigate('/'));

  return (
    <div className="shell">
      {/* 데스크톱: 좌측 사이드바 */}
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav">
          {routes.map((r) => (
            <NavLink key={r.path} to={r.path} end={r.path === '/'} className="side-link">
              <Icon name={r.icon} />
              <span>{r.label}</span>
              {r.requiresAuth && !session && (
                <span className="lock"><Icon name="lock" size={14} /></span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="side-account">
          {session ? (
            <>
              <div className="avatar">{session.user.email?.[0]?.toUpperCase()}</div>
              <div className="account-text">
                <strong className="ellipsis">{session.user.email}</strong>
                <small>로그인됨</small>
              </div>
              <button className="side-icon-btn" onClick={logout} aria-label="로그아웃" title="로그아웃">
                <Icon name="logout" size={18} />
              </button>
            </>
          ) : (
            <NavLink to="/login" className="side-link">
              <Icon name="login" />
              <span>로그인</span>
            </NavLink>
          )}
        </div>
      </aside>

      {/* 모바일: 상단 바 */}
      <header className="topbar">
        <Brand />
        {session ? (
          <button className="side-icon-btn" onClick={logout} aria-label="로그아웃">
            <Icon name="logout" size={20} />
          </button>
        ) : (
          <NavLink to="/login" className="side-icon-btn" aria-label="로그인">
            <Icon name="login" size={20} />
          </NavLink>
        )}
      </header>

      <main className="content">{children}</main>

      {/* 모바일: 하단 탭바 */}
      <nav className="tabbar">
        {routes.map((r) => (
          <NavLink key={r.path} to={r.path} end={r.path === '/'} className="tab-link">
            <Icon name={r.icon} size={22} />
            <span>{r.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
