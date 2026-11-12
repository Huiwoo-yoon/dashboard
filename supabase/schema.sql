-- ============================================================
-- My Dashboard 스키마 (Supabase SQL Editor에 붙여넣고 Run)
-- 모든 테이블: RLS ON, 로그인한 본인(user_id = auth.uid()) 행만 접근 가능
-- 테이블 이름은 dash_ 접두어: 같은 Supabase 프로젝트를 다른 앱과 함께 써도 겹치지 않게 한다.
-- 여러 번 실행해도 안전하도록 if not exists / drop policy if exists 사용
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
