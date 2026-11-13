# 🗂️ My Dashboard

GitHub Pages에 올리는 개인 대시보드. 홈(앱 서랍)은 누구나 볼 수 있고, Todo·운동·식단·건강·소식·경제 동향은 로그인한 본인만 볼 수 있습니다.

- **스택**: Vite + React + TypeScript, HashRouter, Supabase(Auth + Postgres + RLS)
- **배포**: `main`에 push → GitHub Actions → GitHub Pages

> ⚠️ 사이트와 `src/data/apps.json`은 **공개**됩니다. 앱 서랍에 민감한 내용(환자 정보, 내부 주소, 키 등)을 적지 마세요.
> 개인 데이터는 Supabase에만 저장되고 RLS로 보호됩니다.
>
> 📁 프로젝트 위치는 `~/dev/DashBoard`입니다. OneDrive 동기화 폴더에 두면 `node_modules`나 소스 파일이 클라우드 전용으로 바뀌거나 비워질 수 있어 밖으로 옮겼습니다. 백업은 git/GitHub가 맡습니다.

---

## 1. Supabase 설정

1. **프로젝트 생성** — https://supabase.com → New project (Region: Northeast Asia (Seoul) 추천)
2. **스키마 실행** — 왼쪽 메뉴 *SQL Editor* → New query → `supabase/schema.sql` 전체 붙여넣기 → **Run**
   - 테이블 4개(dash_todos, dash_workout_items, dash_workout_logs, dash_meals) + RLS 정책이 만들어집니다.
   - *Table Editor*에서 각 테이블에 🔒 `RLS enabled`가 표시되는지 확인하세요.
   - 이전 버전 스키마를 이미 실행했다면 `supabase/002_update.sql`만 추가로 실행합니다 (운동 시간대·장소·메모, 식단 영양 분석, 인사이트, 소식 테이블). 여러 번 실행해도 안전합니다.
   - 경제 동향 탭: `supabase/003_market.sql` 실행 (관심 종목·시세 테이블 + 기본 9종목).
   - 건강 탭: `supabase/004_health.sql` 실행 (키·체중 기록, 주간 건강 리포트 테이블).
   - (선택) 운동 루틴 초기값: `supabase/seed_routine.local.sql`의 이메일을 바꿔 실행. 건강 정보가 들어 있어 git에서 제외된 파일입니다.
3. **내 계정 만들기** — *Authentication → Users → Add user → Create new user*
   - 이메일 + 비밀번호 입력, **Auto Confirm User** 체크
4. **회원가입 막기** — *Authentication → Sign In / Providers*
   - **Allow new users to sign up** 끄기 (내 계정 외에는 가입 불가)
   - Email provider는 켜둔 상태 유지
5. **URL 등록** — *Authentication → URL Configuration*
   - **Site URL**: `https://<GitHub아이디>.github.io/<저장소이름>/`
   - **Redirect URLs**에 추가:
     - `https://<GitHub아이디>.github.io/<저장소이름>/`
     - `http://localhost:5173/` (로컬 개발용)
   - 매직링크 로그인은 이 주소로 돌아옵니다.
6. **키 복사** — *Project Settings → API* (또는 *API Keys*)
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` `public` 키 → `VITE_SUPABASE_ANON_KEY`
   - ❌ `service_role` 키는 웹 코드·`.env`·GitHub에 절대 넣지 마세요 (RLS를 우회합니다). 유일한 예외는 아래 4번의 맥미니 로컬 스크립트(`scripts/.env.local`)입니다.

## 2. 로컬 실행

```bash
cp .env.example .env
```

`.env`를 열어 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 채운 뒤:

```bash
npm install
```

```bash
npm run dev
```

http://localhost:5173 에서 확인합니다. `.env`는 `.gitignore`에 들어 있어 커밋되지 않습니다.

빌드 확인:

```bash
npm run build
```

## 3. GitHub Pages 배포

1. GitHub에 새 저장소 생성 (예: `DashBoard`, README 없이 빈 저장소) 후 push
   - 이 폴더는 이미 git 저장소입니다 (`~/dev/DashBoard`, 브랜치 `main`).
   ```bash
   git remote add origin https://github.com/<아이디>/<저장소이름>.git && git push -u origin main
   ```
2. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. 저장소 **Settings → Secrets and variables → Actions**
   - *Variables* 탭(또는 *Secrets* 탭)에 등록:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - (선택) `VITE_BASE` — 기본값은 `/<저장소이름>/`. `<아이디>.github.io` 저장소라면 `/`로 지정
   - anon 키는 브라우저에 노출되는 공개 키라 Variables여도 괜찮지만, 신경 쓰이면 Secrets에 넣으세요.
4. `main`에 push하면 *Actions* 탭에서 배포가 진행되고, 끝나면 `https://<아이디>.github.io/<저장소이름>/`에서 열립니다.

## 4. 맥미니 정기 작업 (식단 분석 · 주간 건강 · 주간 소식 · 경제 동향)

웹은 기록만 하고, 분석·수집은 맥미니의 `scripts/daily.mjs`가 맡습니다.

- **매일 06:30 뉴스 제목 모으기**(`collect`): `scripts/news-feeds.json`의 분야별 RSS에서 제목만 받아 로컬 `scripts/news-cache.json`(git 제외)에 쌓습니다. 화면에는 아무것도 표시되지 않습니다. RSS는 반나절~이틀치만 담고 있어서 매일 모아야 한 주를 덮을 수 있습니다.
- **매주 금요일 07:00 주간 소식**(`news`): 지난 금~목 기사를 경제·문화·세계·과학·의학·정신의학·IT·생활 분야별로 Gemini가 주요 뉴스 5~10개(한 줄 설명 포함)와 분야별 한 줄 요약으로 정리해 `dash_news_digests`에 저장. 정신의학은 국내 2개 + 해외(Medscape Psychiatry 등) 8개 정도로 고릅니다. 소식 탭은 일주일에 한 번, 금요일에만 바뀝니다.
- **경제 동향**(`market`): Yahoo Finance 차트 데이터(키 불필요)로 관심 종목의 직전 거래일 시세와 기간별(일·주·월·연·5년·최대) 차트를 `dash_market_quotes`에 저장. 매일 07:30(미국 장 마감 후)·16:30(국내 장 마감 후) 전체 갱신, 10분마다 새로 추가한 종목만 채움(`market --missing`). 종목은 화면의 **편집**에서 Yahoo 티커로 추가·삭제합니다 (예: `AAPL`, `000660.KS`, `GC=F`, `BTC-KRW`).
- **매주 월요일 07:15 주간 건강 리포트**(`health`): 지난 월~일 식단·운동 체크·체중을 모아 평균 열량·탄단지 비율·운동 달성률·BMI는 스크립트가 직접 계산하고, Gemini가 식단 구성·운동·체중 평가와 잘한 점·조절할 부분·다음 주 목표를 써서 `dash_health_reports`에 저장. 시작 전에 아직 분석 안 된 식단을 먼저 분석합니다. 특정 주를 다시 만들려면 `node scripts/daily.mjs health --week 2026-11-09`(그 주 월요일).
- **매일 23:00 식단**(`meals`): 아직 분석 안 된 식단(`analyzed_at` 비어 있음, 최대 14일치)을 Gemini로 보내 음식 이름·kcal·탄단지를 채우고 하루 인사이트를 `dash_meal_insights`에 저장. 식단 내용을 고치면 다시 분석됩니다. 직접 입력한 kcal이 AI 추정치보다 우선합니다.

설정:

```bash
cp scripts/.env.local.example scripts/.env.local && chmod 600 scripts/.env.local
```

`scripts/.env.local`에 `SUPABASE_URL`(또는 `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`를 채웁니다. 선택: `GEMINI_MODEL`(기본 `gemini-3.5-flash-lite`), `DASH_USER_EMAIL`, `MEAL_CONTEXT`(인사이트·주간 건강 평가에 반영할 내 상황, 예: 나이·성별·목표 — Gemini로 전송됨).

수동 실행 / 테스트:

```bash
node scripts/daily.mjs all
```

```bash
node scripts/daily.mjs collect --dry-run
```

자동 실행 등록(launchd) / 해제:

```bash
./scripts/install-launchd.sh
```

```bash
./scripts/uninstall-launchd.sh
```

- 시간은 `install-launchd.sh` 안의 숫자를 고친 뒤 다시 실행하면 바뀝니다.
- 로그: `~/Library/Logs/dashboard/collect.log`, `news.log`, `meals.log`, `health.log`, `market.log`
- 맥미니가 잠자기 중이었다면 깨어날 때 놓친 작업이 한 번 실행됩니다. 전원이 꺼져 있었다면 건너뜁니다(식단은 다음 날 밀린 것까지 분석). 로그아웃 상태에서는 실행되지 않습니다.
- 지금 바로 한 번 돌려 보기: `launchctl kickstart gui/$(id -u)/com.dashboard.weekly-news` (또는 `com.dashboard.daily-meals`, `com.dashboard.weekly-health`)

---

## 구조

```
src/
  routes.ts          메뉴·라우트 정의 (여기에 한 줄 추가 = 새 메뉴)
  lib/supabase.ts    Supabase 클라이언트
  lib/date.ts        Asia/Seoul 기준 날짜 유틸
  api/               데이터 접근 함수 (pages는 여기만 호출)
  components/        Layout(사이드바/탭바), 인증, 공통 UI
  pages/             Home, Todo, Workout, Meals, Health, News, Market, Login
  data/apps.json     앱 서랍 목록
supabase/schema.sql  테이블 + RLS (002 포함 전체)
supabase/002_update.sql, 003_market.sql, 004_health.sql  기존 프로젝트용 추가 변경
scripts/daily.mjs    맥미니 정기 작업 (식단 분석·주간 건강·주간 소식·경제 동향)
```

### 앱 서랍에 앱 추가

`src/data/apps.json`에 한 줄 추가하면 끝입니다.

```json
{ "id": "my-app", "name": "새 앱", "description": "한 줄 설명", "url": "https://...", "category": "앱", "icon": "✨", "status": "개발중" },
```

- `category`: `게임` / `앱` / `자료` / `기타`
- `status`(파일철 폴더): `사용중` / `개발중` / `보관`
- `url`을 비워두면 "로컬 전용" 카드로 표시됩니다(클릭 안 됨).

### 동작 메모

- **운동**: 루틴 항목의 "삭제"는 `active=false`로 숨기는 방식이라 지난 체크 기록이 남습니다. 체크는 `dash_workout_logs`에 날짜별로 저장되고, 자정(서울 기준)이 지나면 화면이 자동으로 새 날짜로 바뀝니다. 14일 달성률은 *현재 루틴 항목* 기준입니다.
- **매직링크**: PKCE 방식이라 링크를 **요청한 같은 브라우저**에서 열어야 로그인됩니다. 폰에서는 비밀번호 로그인이 더 편합니다.

### 나중에 붙일 것 (이번 범위 제외)

- 시세 페이지 → `src/pages/`에 페이지, `src/api/`에 함수, `src/routes.ts`에 한 줄
- 로컬 백업 → `scripts/`에 명령을 추가해 같은 launchd 방식으로 실행 (키는 `scripts/.env.local` 재사용)
