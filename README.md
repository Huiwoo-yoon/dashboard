# 🗂️ My Dashboard

GitHub Pages에 올리는 개인 대시보드. 홈(앱 서랍)은 누구나 볼 수 있고, Todo·운동·식단은 로그인한 본인만 볼 수 있습니다.

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
   - ❌ `service_role` 키는 절대 사용하지 마세요 (RLS를 우회합니다).

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

---

## 구조

```
src/
  routes.ts          메뉴·라우트 정의 (여기에 한 줄 추가 = 새 메뉴)
  lib/supabase.ts    Supabase 클라이언트
  lib/date.ts        Asia/Seoul 기준 날짜 유틸
  api/               데이터 접근 함수 (pages는 여기만 호출)
  components/        Layout(사이드바/탭바), 인증, 공통 UI
  pages/             Home, Todo, Workout, Meals, Login
  data/apps.json     앱 서랍 목록
supabase/schema.sql  테이블 + RLS
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

- 뉴스/시세 페이지 → `src/pages/`에 페이지, `src/api/`에 함수, `src/routes.ts`에 한 줄
- 로컬 백업 → 이 맥미니에서 주기적으로 실행하는 스크립트(launchd)로 Supabase 데이터를 내려받는 방식. 이때만 서버 쪽 키가 필요하며 **맥미니 로컬에만** 보관합니다.
