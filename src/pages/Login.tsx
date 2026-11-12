import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { sendMagicLink, signInWithPassword } from '../api/auth';
import { supabaseConfigured } from '../lib/supabase';
import { errMsg } from '../components/ui';

export default function Login() {
  const { session } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (session) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'password') {
        await signInWithPassword(email.trim(), password);
      } else {
        await sendMagicLink(email.trim());
        setMessage({ kind: 'ok', text: '로그인 링크를 보냈습니다. 같은 브라우저에서 메일의 링크를 여세요.' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={onSubmit}>
        <div>
          <div className="eyebrow">Sign in</div>
          <h1>로그인</h1>
        </div>
        <p className="muted">Todo·운동·식단 기록은 로그인한 본인만 볼 수 있습니다.</p>

        {!supabaseConfigured && (
          <div className="error-banner">
            Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다. README를 참고하세요.
          </div>
        )}

        <div className="segmented">
          <button type="button" className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>
            비밀번호
          </button>
          <button type="button" className={mode === 'magic' ? 'active' : ''} onClick={() => setMode('magic')}>
            매직링크
          </button>
        </div>

        <label className="field">
          <span>이메일</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {mode === 'password' && (
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        <button className="btn primary block" disabled={busy || !supabaseConfigured}>
          {busy ? '처리 중…' : mode === 'password' ? '로그인' : '로그인 링크 받기'}
        </button>

        {message && <p className={message.kind === 'ok' ? 'ok-text' : 'err-text'}>{message.text}</p>}
      </form>
    </div>
  );
}
