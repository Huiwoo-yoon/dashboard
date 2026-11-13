-- ============================================================
-- 004: 주간 건강 리포트 (키·체중 기록 + 지난 1주 식단·운동 AI 평가)
-- SQL Editor에서 한 번 실행. 여러 번 실행해도 안전.
-- 리포트는 맥미니 로컬 스크립트가 Gemini로 만들어 service_role 키로 기록한다.
-- ============================================================

-- ---------- 키 (한 사람당 한 줄) ----------
create table if not exists public.dash_profile (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm   numeric(5,1) check (height_cm is null or height_cm between 50 and 250),
  updated_at  timestamptz not null default now()
);

-- ---------- 체중 (날짜별 한 번) ----------
create table if not exists public.dash_body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weigh_date  date not null,
  weight_kg   numeric(5,1) not null check (weight_kg between 20 and 300),
  created_at  timestamptz not null default now(),
  unique (user_id, weigh_date)
);
create index if not exists dash_body_weights_user_date_idx on public.dash_body_weights (user_id, weigh_date);

-- ---------- 주간 건강 리포트 ----------
create table if not exists public.dash_health_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start  date not null,                          -- 그 주 월요일
  stats       jsonb not null default '{}'::jsonb,     -- 스크립트가 계산한 숫자
  report      jsonb not null default '{}'::jsonb,     -- Gemini 평가
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.dash_profile        enable row level security;
alter table public.dash_body_weights   enable row level security;
alter table public.dash_health_reports enable row level security;
revoke all on public.dash_profile, public.dash_body_weights, public.dash_health_reports from anon;

drop policy if exists "dash_profile_select_own" on public.dash_profile;
drop policy if exists "dash_profile_insert_own" on public.dash_profile;
drop policy if exists "dash_profile_update_own" on public.dash_profile;
create policy "dash_profile_select_own" on public.dash_profile for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_profile_insert_own" on public.dash_profile for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_profile_update_own" on public.dash_profile for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dash_body_weights_select_own" on public.dash_body_weights;
drop policy if exists "dash_body_weights_insert_own" on public.dash_body_weights;
drop policy if exists "dash_body_weights_update_own" on public.dash_body_weights;
drop policy if exists "dash_body_weights_delete_own" on public.dash_body_weights;
create policy "dash_body_weights_select_own" on public.dash_body_weights for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_body_weights_insert_own" on public.dash_body_weights for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_body_weights_update_own" on public.dash_body_weights for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_body_weights_delete_own" on public.dash_body_weights for delete to authenticated using ((select auth.uid()) = user_id);

-- 화면에서는 읽기·삭제만 (쓰기는 로컬 스크립트)
drop policy if exists "dash_health_reports_select_own" on public.dash_health_reports;
drop policy if exists "dash_health_reports_delete_own" on public.dash_health_reports;
create policy "dash_health_reports_select_own" on public.dash_health_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_health_reports_delete_own" on public.dash_health_reports for delete to authenticated using ((select auth.uid()) = user_id);
