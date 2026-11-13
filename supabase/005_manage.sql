-- ============================================================
-- 005: 관리 탭 (건강 기록·인사이트 + 차량 관리)
-- SQL Editor에서 한 번 실행. 여러 번 실행해도 안전.
-- 건강검진 기록은 Health_record_manager 앱의 테이블(health_records, lab_results 등)을
-- 그 앱의 RLS 그대로 읽기만 한다. 여기서는 대시보드 쪽 테이블만 만든다.
-- ============================================================

-- 검진 기록에서 '나'로 볼 가족 구성원
alter table public.dash_profile add column if not exists health_member_id uuid;

-- ---------- 내 건강 메모 (복용약·알레르기·병력·가족력·목표 등) ----------
create table if not exists public.dash_health_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null check (length(category) between 1 and 30),
  content     text not null check (length(content) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists dash_health_notes_user_idx on public.dash_health_notes (user_id, created_at);

-- ---------- 검진 AI 인사이트 (한 사람당 한 줄, 맥미니가 작성) ----------
create table if not exists public.dash_checkup_insights (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  member_id     uuid,
  insight       jsonb,
  source_stamp  text,          -- 분석에 쓴 데이터의 지문 (바뀌면 다시 분석)
  requested_at  timestamptz,   -- 화면의 '다시 분석' 버튼
  created_at    timestamptz
);

-- ---------- 차량 ----------
create table if not exists public.dash_cars (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(name) between 1 and 50),
  fuel           text not null default '휘발유' check (length(fuel) <= 20),
  odometer_km    int check (odometer_km is null or odometer_km between 0 and 2000000),
  odometer_date  date,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- 점검 항목: 주기(km/개월)와 마지막으로 한 날
create table if not exists public.dash_car_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id           uuid not null references public.dash_cars (id) on delete cascade,
  category         text not null default '기타' check (length(category) <= 30),
  name             text not null check (length(name) between 1 and 100),
  interval_km      int check (interval_km is null or interval_km > 0),
  interval_months  int check (interval_months is null or interval_months > 0),
  note             text check (note is null or length(note) <= 500),
  last_done_date   date,
  last_done_km     int,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists dash_car_items_car_idx on public.dash_car_items (car_id, sort_order);

-- 정비 이력
create table if not exists public.dash_car_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id      uuid not null references public.dash_cars (id) on delete cascade,
  item_id     uuid references public.dash_car_items (id) on delete set null,
  item_name   text not null check (length(item_name) between 1 and 100),
  done_date   date not null,
  km          int,
  cost        int check (cost is null or cost >= 0),
  memo        text check (memo is null or length(memo) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists dash_car_logs_car_idx on public.dash_car_logs (car_id, done_date);

-- ---------- RLS: 본인 행만 ----------
alter table public.dash_health_notes     enable row level security;
alter table public.dash_checkup_insights enable row level security;
alter table public.dash_cars             enable row level security;
alter table public.dash_car_items        enable row level security;
alter table public.dash_car_logs         enable row level security;
revoke all on public.dash_health_notes, public.dash_checkup_insights, public.dash_cars, public.dash_car_items, public.dash_car_logs from anon;

do $$
declare t text;
begin
  foreach t in array array['dash_health_notes', 'dash_checkup_insights', 'dash_cars', 'dash_car_items', 'dash_car_logs'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- 다른 사람의 차에 점검 항목·이력을 붙이지 못하게
drop policy if exists "dash_car_items_insert_own" on public.dash_car_items;
create policy "dash_car_items_insert_own" on public.dash_car_items for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (select 1 from public.dash_cars c where c.id = car_id and c.user_id = (select auth.uid()))
);
drop policy if exists "dash_car_logs_insert_own" on public.dash_car_logs;
create policy "dash_car_logs_insert_own" on public.dash_car_logs for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (select 1 from public.dash_cars c where c.id = car_id and c.user_id = (select auth.uid()))
);
