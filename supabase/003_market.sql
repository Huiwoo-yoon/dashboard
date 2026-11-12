-- ============================================================
-- 003: 경제 동향 (관심 종목 + 직전 거래일 시세 + 기간별 차트)
-- SQL Editor에서 한 번 실행. 여러 번 실행해도 안전.
-- 시세는 맥미니 로컬 스크립트가 Yahoo Finance에서 받아 service_role 키로 기록한다.
-- ============================================================

-- 관심 종목 (화면에서 추가·삭제)
create table if not exists public.dash_market_symbols (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null check (length(symbol) between 1 and 30),   -- Yahoo 티커 (예: ^GSPC, 005930.KS)
  label       text not null check (length(label) between 1 and 40),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, symbol)
);

-- 시세 + 차트 (스크립트가 기록)
create table if not exists public.dash_market_quotes (
  user_id      uuid not null references auth.users (id) on delete cascade,
  symbol       text not null,
  name         text,
  currency     text,
  price        double precision,
  prev_close   double precision,
  market_time  timestamptz,
  history      jsonb not null default '{}'::jsonb,   -- {"1d":[[unix초, 값], …], "5d":…, "1mo":…, "1y":…, "5y":…, "max":…}
  error        text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.dash_market_symbols enable row level security;
alter table public.dash_market_quotes  enable row level security;
revoke all on public.dash_market_symbols, public.dash_market_quotes from anon;

drop policy if exists "dash_market_symbols_select_own" on public.dash_market_symbols;
drop policy if exists "dash_market_symbols_insert_own" on public.dash_market_symbols;
drop policy if exists "dash_market_symbols_update_own" on public.dash_market_symbols;
drop policy if exists "dash_market_symbols_delete_own" on public.dash_market_symbols;
create policy "dash_market_symbols_select_own" on public.dash_market_symbols for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_market_symbols_insert_own" on public.dash_market_symbols for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_market_symbols_update_own" on public.dash_market_symbols for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_market_symbols_delete_own" on public.dash_market_symbols for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dash_market_quotes_select_own" on public.dash_market_quotes;
create policy "dash_market_quotes_select_own" on public.dash_market_quotes for select to authenticated using ((select auth.uid()) = user_id);

-- 기본 종목 (계정이 하나뿐이므로 그 계정에 넣는다. 이미 있으면 건너뜀)
insert into public.dash_market_symbols (user_id, symbol, label, sort_order)
select u.id, v.symbol, v.label, v.ord
from auth.users u
cross join (values
  ('KRW=X',     '원/달러 환율', 1),
  ('^GSPC',     'S&P 500',      2),
  ('^IXIC',     '나스닥',        3),
  ('^KS11',     '코스피',        4),
  ('BTC-USD',   '비트코인',      5),
  ('005930.KS', '삼성전자',      6),
  ('IONQ',      'IonQ',         7)
) as v(symbol, label, ord)
on conflict (user_id, symbol) do nothing;
