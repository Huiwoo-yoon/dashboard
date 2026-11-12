-- ============================================================
-- My Dashboard 스키마 (Supabase SQL Editor에 붙여넣고 Run)
-- 모든 테이블: RLS ON, 로그인한 본인(user_id = auth.uid()) 행만 접근 가능
-- 테이블 이름은 dash_ 접두어: 같은 Supabase 프로젝트를 다른 앱과 함께 써도 겹치지 않게 한다.
-- (002_update.sql 내용 포함) 여러 번 실행해도 안전하도록 if not exists / drop policy if exists 사용
-- ============================================================

-- ---------- dash_todos ----------
create table if not exists public.dash_todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (length(title) between 1 and 500),
  done        boolean not null default false,
  due_date    date,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists dash_todos_user_idx on public.dash_todos (user_id);

-- ---------- dash_workout_items (루틴 항목) ----------
create table if not exists public.dash_workout_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists dash_workout_items_user_idx on public.dash_workout_items (user_id, sort_order);

-- ---------- dash_workout_logs (날짜별 체크 기록) ----------
create table if not exists public.dash_workout_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id     uuid not null references public.dash_workout_items (id) on delete cascade,
  log_date    date not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (item_id, log_date)
);
create index if not exists dash_workout_logs_user_date_idx on public.dash_workout_logs (user_id, log_date);

-- ---------- dash_meals ----------
create table if not exists public.dash_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_date   date not null,
  meal_type   text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null default '' check (length(description) <= 2000),
  kcal        int null check (kcal is null or kcal between 0 and 20000),
  created_at  timestamptz not null default now()
);
create index if not exists dash_meals_user_date_idx on public.dash_meals (user_id, meal_date);

-- ============================================================
-- RLS
-- ============================================================
alter table public.dash_todos         enable row level security;
alter table public.dash_workout_items enable row level security;
alter table public.dash_workout_logs  enable row level security;
alter table public.dash_meals         enable row level security;

-- 비로그인(anon) 역할은 어떤 테이블에도 접근 불가
revoke all on public.dash_todos, public.dash_workout_items, public.dash_workout_logs, public.dash_meals from anon;

-- dash_todos
drop policy if exists "dash_todos_select_own" on public.dash_todos;
drop policy if exists "dash_todos_insert_own" on public.dash_todos;
drop policy if exists "dash_todos_update_own" on public.dash_todos;
drop policy if exists "dash_todos_delete_own" on public.dash_todos;
create policy "dash_todos_select_own" on public.dash_todos for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_todos_insert_own" on public.dash_todos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_todos_update_own" on public.dash_todos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_todos_delete_own" on public.dash_todos for delete to authenticated using ((select auth.uid()) = user_id);

-- dash_workout_items
drop policy if exists "dash_workout_items_select_own" on public.dash_workout_items;
drop policy if exists "dash_workout_items_insert_own" on public.dash_workout_items;
drop policy if exists "dash_workout_items_update_own" on public.dash_workout_items;
drop policy if exists "dash_workout_items_delete_own" on public.dash_workout_items;
create policy "dash_workout_items_select_own" on public.dash_workout_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_workout_items_insert_own" on public.dash_workout_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_workout_items_update_own" on public.dash_workout_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_workout_items_delete_own" on public.dash_workout_items for delete to authenticated using ((select auth.uid()) = user_id);

-- dash_workout_logs (item_id도 본인 항목이어야 함)
drop policy if exists "dash_workout_logs_select_own" on public.dash_workout_logs;
drop policy if exists "dash_workout_logs_insert_own" on public.dash_workout_logs;
drop policy if exists "dash_workout_logs_update_own" on public.dash_workout_logs;
drop policy if exists "dash_workout_logs_delete_own" on public.dash_workout_logs;
create policy "dash_workout_logs_select_own" on public.dash_workout_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_workout_logs_insert_own" on public.dash_workout_logs for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.dash_workout_items i where i.id = item_id and i.user_id = (select auth.uid()))
);
create policy "dash_workout_logs_update_own" on public.dash_workout_logs for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.dash_workout_items i where i.id = item_id and i.user_id = (select auth.uid()))
);
create policy "dash_workout_logs_delete_own" on public.dash_workout_logs for delete to authenticated using ((select auth.uid()) = user_id);

-- dash_meals
drop policy if exists "dash_meals_select_own" on public.dash_meals;
drop policy if exists "dash_meals_insert_own" on public.dash_meals;
drop policy if exists "dash_meals_update_own" on public.dash_meals;
drop policy if exists "dash_meals_delete_own" on public.dash_meals;
create policy "dash_meals_select_own" on public.dash_meals for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_meals_insert_own" on public.dash_meals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_meals_update_own" on public.dash_meals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_meals_delete_own" on public.dash_meals for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- 운동 루틴: 시간대 / 장소 / 핵심 포인트 ----------
alter table public.dash_workout_items add column if not exists time_label text check (time_label is null or length(time_label) <= 50);
alter table public.dash_workout_items add column if not exists place text check (place is null or length(place) <= 50);
alter table public.dash_workout_items add column if not exists note text check (note is null or length(note) <= 1000);

-- ---------- 식단: AI 분석 결과 ----------
alter table public.dash_meals add column if not exists food_name text;
alter table public.dash_meals add column if not exists ai_kcal int check (ai_kcal is null or ai_kcal between 0 and 20000);
alter table public.dash_meals add column if not exists protein_g numeric(6,1);
alter table public.dash_meals add column if not exists carbs_g numeric(6,1);
alter table public.dash_meals add column if not exists fat_g numeric(6,1);
alter table public.dash_meals add column if not exists analyzed_at timestamptz;
create index if not exists dash_meals_unanalyzed_idx on public.dash_meals (analyzed_at) where analyzed_at is null;

-- ---------- 식단: 하루 인사이트 ----------
create table if not exists public.dash_meal_insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  insight_date  date not null,
  summary       text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, insight_date)
);

-- ---------- 오늘의 소식 ----------
create table if not exists public.dash_news_digests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  digest_date  date not null,
  summary      text not null,
  items        jsonb not null default '[]'::jsonb,   -- [{title, url, source, published_at, topic}]
  created_at   timestamptz not null default now(),
  unique (user_id, digest_date)
);

alter table public.dash_meal_insights enable row level security;
alter table public.dash_news_digests  enable row level security;
revoke all on public.dash_meal_insights, public.dash_news_digests from anon;

-- 화면에서는 읽기·삭제만 (쓰기는 로컬 스크립트)
drop policy if exists "dash_meal_insights_select_own" on public.dash_meal_insights;
drop policy if exists "dash_meal_insights_delete_own" on public.dash_meal_insights;
create policy "dash_meal_insights_select_own" on public.dash_meal_insights for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_meal_insights_delete_own" on public.dash_meal_insights for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dash_news_digests_select_own" on public.dash_news_digests;
drop policy if exists "dash_news_digests_delete_own" on public.dash_news_digests;
create policy "dash_news_digests_select_own" on public.dash_news_digests for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_news_digests_delete_own" on public.dash_news_digests for delete to authenticated using ((select auth.uid()) = user_id);

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
