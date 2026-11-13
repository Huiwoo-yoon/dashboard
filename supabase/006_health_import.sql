-- ============================================================
-- 006: 가족 구성원별 건강 정보 + 검사 결과 붙여넣기(AI 정리 → 검토 → 저장)
-- SQL Editor에서 한 번 실행. 여러 번 실행해도 안전.
-- 정리된 결과·증상·약은 Health log 앱 테이블(health_records, lab_results, episodes,
-- symptom_logs, medication_logs)에 그 앱의 RLS로 저장된다. 여기서는 대시보드 쪽만 바꾼다.
-- ============================================================

-- 기본 정보(메모)를 사람별로
alter table public.dash_health_notes add column if not exists member_id uuid;
create index if not exists dash_health_notes_member_idx on public.dash_health_notes (user_id, member_id);

-- 검진 인사이트를 사람별로 (기본키: 계정 + 사람)
delete from public.dash_checkup_insights where member_id is null;
alter table public.dash_checkup_insights alter column member_id set not null;
alter table public.dash_checkup_insights drop constraint if exists dash_checkup_insights_pkey;
alter table public.dash_checkup_insights add primary key (user_id, member_id);

-- ---------- 붙여넣은 원문과 AI 초안 ----------
create table if not exists public.dash_health_imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  member_id   uuid not null,
  kind        text not null check (kind in ('checkup', 'episode')),   -- 검사 결과 / 아플 때 기록
  raw_text    text not null check (length(raw_text) between 1 and 60000),
  status      text not null default 'pending' check (status in ('pending', 'parsing', 'ready', 'saved', 'failed')),
  draft       jsonb,
  model       text,
  error       text,
  created_at  timestamptz not null default now(),
  parsed_at   timestamptz,
  saved_at    timestamptz
);
create index if not exists dash_health_imports_pending_idx on public.dash_health_imports (status) where status = 'pending';
create index if not exists dash_health_imports_user_idx on public.dash_health_imports (user_id, member_id, created_at);

alter table public.dash_health_imports enable row level security;
revoke all on public.dash_health_imports from anon;
drop policy if exists "dash_health_imports_select_own" on public.dash_health_imports;
drop policy if exists "dash_health_imports_insert_own" on public.dash_health_imports;
drop policy if exists "dash_health_imports_update_own" on public.dash_health_imports;
drop policy if exists "dash_health_imports_delete_own" on public.dash_health_imports;
create policy "dash_health_imports_select_own" on public.dash_health_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy "dash_health_imports_insert_own" on public.dash_health_imports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dash_health_imports_update_own" on public.dash_health_imports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dash_health_imports_delete_own" on public.dash_health_imports for delete to authenticated using ((select auth.uid()) = user_id);
