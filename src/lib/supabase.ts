import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** .env가 비어 있으면 false — 로그인 화면에서 안내 문구를 띄운다. */
export const supabaseConfigured = Boolean(url && anonKey);

// 환경변수가 없어도 앱(홈 화면)은 뜨도록 자리표시 값으로 생성한다.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    // PKCE: 매직링크가 ?code= 쿼리로 돌아와 HashRouter의 #/경로와 충돌하지 않는다.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
