-- ============================================================
-- 002: 운동 루틴 시간대·장소·메모 / 식단 영양 분석 / 하루 인사이트 / 오늘의 소식
-- 이미 schema.sql을 실행한 프로젝트에서 SQL Editor로 한 번 실행. 여러 번 실행해도 안전.
-- (분석·뉴스 수집은 맥미니의 로컬 스크립트가 service_role 키로 기록한다)
-- ============================================================

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
