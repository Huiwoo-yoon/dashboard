#!/usr/bin/env node
// 맥미니에서 매일 실행하는 로컬 작업 (launchd가 호출)
//   node scripts/daily.mjs meals   식단 AI 분석 (칼로리·탄단지·하루 인사이트)
//   node scripts/daily.mjs collect 뉴스 제목만 로컬에 모아 두기 (매일, 화면 표시 없음)
//   node scripts/daily.mjs news    지난 금~목 주간 소식 정리 (매주 금요일)
//   node scripts/daily.mjs market  경제 동향: 관심 종목 시세·차트 갱신 (--missing: 새로 추가된 종목만)
//   node scripts/daily.mjs health  주간 건강 리포트: 지난 월~일 식단·운동·체중 평가 (매주 월요일, --week 2026-11-09 로 특정 주)
//   node scripts/daily.mjs checkup 건강검진 AI 인사이트 (기록·메모가 바뀌었거나 화면에서 요청했을 때만, 10분마다 확인. --force: 무조건)
//   node scripts/daily.mjs all
// 설정: scripts/.env.local (git에 올라가지 않음) — 아래 ENV 항목 참고

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- 설정 ----------
const envFile = join(here, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, // RLS 우회 — 이 맥미니에만 보관
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  DASH_USER_EMAIL: process.env.DASH_USER_EMAIL, // 비우면 dash_ 데이터의 주인을 자동으로 찾음
  MEAL_CONTEXT: process.env.MEAL_CONTEXT || '', // 인사이트에 반영할 내 상황 (선택)
};
const DRY = process.argv.includes('--dry-run'); // 뉴스 피드만 받아 보고 끝 (키 불필요)
for (const k of DRY ? [] : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']) {
  if (!ENV[k]) {
    console.error(`[설정 누락] ${k} — scripts/.env.local 을 확인하세요`);
    process.exit(1);
  }
}

const db = DRY ? null : createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(new Date().toISOString(), ...a);
const todaySeoul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

// ---------- 공통 ----------
async function resolveUserId() {
  if (ENV.DASH_USER_EMAIL) {
    const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === ENV.DASH_USER_EMAIL.toLowerCase());
    if (!u) throw new Error(`DASH_USER_EMAIL 사용자를 찾을 수 없음`);
    return u.id;
  }
  const ids = new Set();
  for (const t of ['dash_todos', 'dash_workout_items', 'dash_meals']) {
    const { data, error } = await db.from(t).select('user_id').limit(1000);
    if (error) throw error;
    data.forEach((r) => ids.add(r.user_id));
  }
  if (ids.size === 1) return [...ids][0];
  throw new Error(`대시보드 사용자를 정할 수 없음 (후보 ${ids.size}명) — DASH_USER_EMAIL 을 설정하세요`);
}

async function gemini(prompt, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ENV.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return JSON.parse(text);
}

// ---------- 식단 분석 ----------
const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
const MAX_DAYS_PER_RUN = 14;

async function runMeals(userId) {
  const { data: pending, error } = await db
    .from('dash_meals')
    .select('meal_date')
    .eq('user_id', userId)
    .is('analyzed_at', null);
  if (error) throw error;
  const dates = [...new Set(pending.map((r) => r.meal_date))].sort().slice(-MAX_DAYS_PER_RUN);
  log(`[meals] 분석할 날짜 ${dates.length}일`, dates.join(', '));

  for (const date of dates) {
    const { data: meals, error: e2 } = await db
      .from('dash_meals')
      .select('id, meal_type, description, kcal, analyzed_at, food_name, ai_kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('meal_date', date)
      .order('created_at');
    if (e2) throw e2;

    const lines = meals.map((m) => `- id=${m.id} | ${MEAL_LABEL[m.meal_type]} | ${m.description}${m.kcal != null ? ` | (본인 입력 ${m.kcal}kcal)` : ''}`);
    const prompt = `너는 한국 음식에 밝은 영양사다. 아래는 한 사람이 ${date}에 먹은 것을 자유롭게 적은 기록이다.
각 항목마다:
- food_name: 어떤 음식인지 표준 이름으로 정리 (예: "고등어 백반" → "고등어구이 백반(밥·국·반찬)")
- kcal, protein_g, carbs_g, fat_g: 한국 일반 1인분 기준 추정치. 양이 적혀 있으면 반영. 본인 입력 kcal이 있으면 그 값에 맞춰 영양소를 추정.
그리고 insight: 그날 식단 전체에 대한 한국어 3~4문장 코멘트 (총열량·탄단지 균형·좋았던 점·다음 끼니 제안. 단정적인 의학 조언은 피하고 실용적으로).
${ENV.MEAL_CONTEXT ? `참고할 이 사람의 상황: ${ENV.MEAL_CONTEXT}\n` : ''}
기록:
${lines.join('\n')}`;

    const schema = {
      type: 'OBJECT',
      properties: {
        meals: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              food_name: { type: 'STRING' },
              kcal: { type: 'INTEGER' },
              protein_g: { type: 'NUMBER' },
              carbs_g: { type: 'NUMBER' },
              fat_g: { type: 'NUMBER' },
            },
            required: ['id', 'food_name', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
        insight: { type: 'STRING' },
      },
      required: ['meals', 'insight'],
    };

    const out = await gemini(prompt, schema);
    const now = new Date().toISOString();
    let updated = 0;
    for (const r of out.meals) {
      const m = meals.find((x) => x.id === r.id);
      if (!m || m.analyzed_at) continue; // 이미 분석된 항목은 그대로
      const r1 = (n) => Math.round(Number(n) * 10) / 10;
      const { error: e3 } = await db
        .from('dash_meals')
        .update({
          food_name: String(r.food_name).slice(0, 200),
          ai_kcal: Math.max(0, Math.round(r.kcal)),
          protein_g: r1(r.protein_g),
          carbs_g: r1(r.carbs_g),
          fat_g: r1(r.fat_g),
          analyzed_at: now,
        })
        .eq('id', m.id)
        .eq('user_id', userId);
      if (e3) throw e3;
      updated++;
    }
    const { error: e4 } = await db
      .from('dash_meal_insights')
      .upsert({ user_id: userId, insight_date: date, summary: out.insight }, { onConflict: 'user_id,insight_date' });
    if (e4) throw e4;
    log(`[meals] ${date}: ${updated}개 분석, 인사이트 저장`);
  }
}

// ---------- 주간 소식 ----------
// RSS는 보통 반나절~이틀치만 담고 있어서, 매일 조용히 제목만 모아 두고(collect, 화면 표시 없음)
// 매주 금요일에 지난 금~목 기사를 분야별로 정리한다(news).
const CATEGORIES = ['경제', '문화', '세계', '과학', '의학', '정신의학', 'IT', '생활'];
const CACHE = join(here, 'news-cache.json'); // git 제외
const DAY = 86400 * 1000;

const cdata = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const decode = (s) =>
  cdata(
    cdata(s)
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&'),
  ).trim(); // 일부 피드는 CDATA를 한 번 더 이스케이프해 둔다
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

async function fetchFeed({ source, hint, region, url }) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal RSS reader)' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    return blocks.slice(0, 40).map((b) => {
      const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
      const date = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'dc:date');
      const t = date ? Date.parse(date) : NaN;
      // Google 뉴스는 항목마다 원래 매체(<source>)가 있고 제목 끝에 " - 매체명"이 붙는다
      const itemSource = tag(b, 'source');
      let title = tag(b, 'title');
      if (itemSource && title.endsWith(` - ${itemSource}`)) title = title.slice(0, -(itemSource.length + 3));
      return { source: itemSource || source, hint, region: region ?? null, title, url: tag(b, 'link') || atomLink || '', published_at: isNaN(t) ? null : new Date(t).toISOString() };
    }).filter((i) => i.title && i.url);
  } catch (e) {
    log(`[collect] ${source}(${hint}) 실패: ${e.message}`);
    return [];
  }
}

const readCache = () => (existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : []);

/** 매일: 피드에서 제목만 모아 로컬 캐시에 쌓는다 (9일 지난 것은 버림) */
async function runCollect() {
  const feeds = JSON.parse(readFileSync(join(here, 'news-feeds.json'), 'utf8'));
  const now = new Date().toISOString();
  const fresh = (await Promise.all(feeds.map(fetchFeed))).flat();
  if (DRY) {
    for (const f of feeds) log(`  ${f.source}(${f.hint}): ${fresh.filter((i) => i.url && i.hint === f.hint && i.source === f.source).length}개`);
    return;
  }
  const byUrl = new Map(readCache().map((i) => [i.url, i]));
  let added = 0;
  for (const i of fresh) if (!byUrl.has(i.url)) { byUrl.set(i.url, { ...i, collected_at: now }); added++; }
  const cutoff = Date.now() - 9 * DAY;
  const kept = [...byUrl.values()].filter((i) => Date.parse(i.published_at ?? i.collected_at) >= cutoff);
  writeFileSync(CACHE, JSON.stringify(kept));
  log(`[collect] 새 기사 ${added}개, 보관 ${kept.length}개`);
}

/** 매주: 지난 금~목 기사를 분야별 5~10개로 정리해 저장 (digest_date = 시작 금요일) */
async function runNews(userId) {
  await runCollect();
  if (DRY) return;
  // 가장 최근에 끝난 한 주: 지난주 금요일 00:00 ~ 이번 주 금요일 00:00 (서울 기준)
  const today = todaySeoul();
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일 … 5=금 … 6=토
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
  const thisFriday = ymd(Date.parse(`${today}T00:00:00Z`) - ((wd + 2) % 7) * DAY);
  const weekStart = ymd(Date.parse(`${thisFriday}T00:00:00Z`) - 7 * DAY);
  const start = Date.parse(`${weekStart}T00:00:00+09:00`);
  const end = Date.parse(`${thisFriday}T00:00:00+09:00`);
  const all = readCache().filter((i) => {
    const t = Date.parse(i.published_at ?? i.collected_at);
    return t >= start && t < end;
  });
  log(`[news] ${weekStart}(금) ~ ${ymd(Date.parse(`${thisFriday}T00:00:00Z`) - DAY)}(목), 후보 ${all.length}개`);
  if (all.length === 0) return;

  const schema = {
    type: 'OBJECT',
    properties: {
      headline: { type: 'STRING' },
      picks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { index: { type: 'INTEGER' }, original: { type: 'STRING' }, title: { type: 'STRING' }, note: { type: 'STRING' } },
          required: ['index', 'original', 'title', 'note'],
        },
      },
    },
    required: ['headline', 'picks'],
  };

  const items = [];
  const lines = [];
  const RULES = `  - index: 목록의 번호, original: 그 번호 기사의 원래 제목을 목록에서 글자 그대로 복사
  - title: 한국어로 다듬은 제목 (영어 기사도 한국어로)
  - note: 무슨 내용인지 한국어 한 문장 설명`;
  const PSY = '읽는 사람은 정신건강의학과 의사이고, 디지털 디톡스 중이라 일주일에 한 번만 본다. 임상에 의미 있는 연구 결과, 치료·약물·가이드라인, 정책·제도, 진료 환경 변화 위주로. 일반인 대상 가벼운 건강 팁·광고성·같은 사건 중복 기사는 제외.';

  /** 후보 목록에서 Gemini가 고른 기사를 items에 넣고 headline을 돌려준다 */
  async function pick(cat, pool, task, max) {
    if (pool.length === 0) return null;
    const list = pool.map((i, n) => `${n}. [${i.source}] ${i.title}`).join('\n');
    const out = await gemini(`${task}\n\n${list}`, schema);
    // AI가 번호를 잘못 짚으면 제목과 링크가 어긋난다 → 원래 제목으로 다시 확인하고, 못 찾으면 버린다
    const norm = (t) => String(t).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
    const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 12 && (a.includes(b) || b.includes(a)));
    let added = 0;
    let fixed = 0;
    const used = new Set();
    for (const p of out.picks) {
      if (added >= max) break;
      const want = norm(p.original);
      let a = pool[p.index];
      if (!a || !same(norm(a.title), want)) {
        a = pool.find((x) => same(norm(x.title), want));
        if (!a) continue;
        fixed++;
      }
      if (used.has(a.url)) continue;
      used.add(a.url);
      items.push({ title: String(p.title).replace(/^\[[^\]]+\]\s*/, "").slice(0, 200), url: a.url, source: a.source, published_at: a.published_at, topic: cat, note: String(p.note).slice(0, 300) });
      added++;
    }
    log(`[news] ${cat}: ${added}개 (후보 ${pool.length}${fixed ? `, 번호 어긋남 ${fixed}건 바로잡음` : ''}${out.picks.length - added > 0 ? `, 확인 못 해 제외 ${out.picks.length - added}건` : ''})`);
    return out.headline;
  }

  for (const cat of CATEGORIES) {
    const pool = all.filter((i) => i.hint === cat);
    try {
      if (cat === '정신의학') {
        // 국내 2개 + 해외 8개를 따로 골라 개수를 지킨다. 해외는 Medscape를 목록 앞에 둔다.
        const kr = pool.filter((i) => i.region !== '해외');
        const intl = pool.filter((i) => i.region === '해외').sort((a, b) => (b.source === 'Medscape') - (a.source === 'Medscape'));
        await pick(cat, kr, `아래는 지난 1주일 동안 모은 국내 정신건강 관련 기사 제목이다. ${PSY}
- picks: 정확히 2개
${RULES}
- headline: 빈 문자열이어도 됨`, 2);
        const headline = await pick(cat, intl, `아래는 지난 1주일 동안 모은 해외 정신의학 기사 제목이다. ${PSY}
- picks: 8개. Medscape 기사를 3개 이상 포함하고(있다면), 나머지는 Psychiatric Times·MedPage Today·Healio·ScienceDaily 등에서 고르게.
${RULES} (연구라면 대상·결과 핵심)
- headline: 이번 주 정신의학 분야를 한국어 한 문장으로 요약`, 8);
        if (headline) lines.push(`• ${cat}: ${headline}`);
        continue;
      }
      const headline = await pick(cat, pool, `아래는 지난 1주일 동안 "${cat}" 분야 매체에서 모은 기사 제목이다. 디지털 디톡스 중이라 뉴스를 일주일에 한 번만 보는 사람을 위해 이번 주 "${cat}" 분야에서 꼭 알아둘 만한 주요 뉴스를 골라라.
- picks: 5~10개. 같은 사건의 중복 기사는 하나만. 자극적·가십성·단순 사건사고보다 의미 있는 흐름과 큰 사건 위주.
${RULES}
- headline: 이번 주 "${cat}" 분야를 한 문장으로 요약`, 10);
      if (headline) lines.push(`• ${cat}: ${headline}`);
    } catch (e) {
      log(`[news] ${cat} 실패: ${e.message}`);
    }
  }

  if (items.length === 0) throw new Error('정리된 기사가 없습니다');

  const { error } = await db
    .from('dash_news_digests')
    .upsert({ user_id: userId, digest_date: weekStart, summary: lines.join('\n'), items }, { onConflict: 'user_id,digest_date' });
  if (error) throw error;
  log(`[news] ${weekStart} 주간 소식 저장 (${items.length}개 기사)`);
}

// ---------- 경제 동향 ----------
// Yahoo Finance 차트 API (키 불필요). 화면용 기간: 일·주·월·연·5년·최대
const RANGES = [['1d', '5m'], ['5d', '30m'], ['1mo', '1d'], ['1y', '1d'], ['5y', '1wk'], ['max', '1mo']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function yahooChart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  const json = await res.json().catch(() => null);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description || `HTTP ${res.status}`);
  const ts = result.timestamp ?? [];
  const close = result.indicators?.quote?.[0]?.close ?? [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    if (close[i] != null) points.push([ts[i], Number(close[i].toPrecision(7))]);
  }
  return { meta: result.meta, points };
}

async function runMarket(userId, onlyMissing) {
  const { data: symbols, error } = await db.from('dash_market_symbols').select('symbol').eq('user_id', userId);
  if (error) throw error;
  let targets = symbols.map((s) => s.symbol);
  if (onlyMissing) {
    const { data: have, error: e2 } = await db.from('dash_market_quotes').select('symbol').eq('user_id', userId);
    if (e2) throw e2;
    const done = new Set(have.map((h) => h.symbol));
    targets = targets.filter((s) => !done.has(s));
    if (targets.length === 0) return; // 조용히 끝 (10분마다 도는 작업)
  }
  log(`[market] ${targets.length}개 종목 갱신`);
  for (const symbol of targets) {
    const row = { user_id: userId, symbol, updated_at: new Date().toISOString() };
    try {
      const history = {};
      let meta = null;
      for (const [range, interval] of RANGES) {
        const r = await yahooChart(symbol, range, interval);
        if (range === '1d') meta = r.meta;
        history[range] = r.points;
        await sleep(250);
      }
      Object.assign(row, {
        name: meta.shortName || meta.longName || symbol,
        currency: meta.currency ?? null,
        price: meta.regularMarketPrice ?? null,
        prev_close: meta.chartPreviousClose ?? meta.previousClose ?? null,
        market_time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
        history,
        error: null,
      });
      log(`[market] ${symbol} ${row.price} (전일 ${row.prev_close})`);
    } catch (e) {
      row.error = `시세를 찾지 못했습니다: ${e.message}`.slice(0, 300);
      log(`[market] ${symbol} 실패: ${e.message}`);
    }
    // 실패해도 행을 남겨 화면에 오류를 보여 준다 (이전 데이터가 있으면 error만 갱신)
    const payload = row.error ? { user_id: userId, symbol, error: row.error, updated_at: row.updated_at } : row;
    const { error: e3 } = await db.from('dash_market_quotes').upsert(payload, { onConflict: 'user_id,symbol' });
    if (e3) throw e3;
  }
  // 목록에서 지운 종목의 시세 정리
  const keep = new Set(symbols.map((s) => s.symbol));
  const { data: rows } = await db.from('dash_market_quotes').select('symbol').eq('user_id', userId);
  const stale = (rows ?? []).map((r) => r.symbol).filter((s) => !keep.has(s));
  if (stale.length) await db.from('dash_market_quotes').delete().eq('user_id', userId).in('symbol', stale);
}

// ---------- 건강 기록 (Health log 앱 데이터) ----------
// 검진 기록은 Health_record_manager 앱 테이블에서 읽기만 한다. '나'는 dash_profile.health_member_id,
// 없으면 이 계정의 가족 중 기록이 가장 많은 사람 (화면과 같은 기준).
async function healthContext(userId) {
  const q = async (p) => {
    const { data, error } = await p;
    if (error) throw error;
    return data;
  };
  const links = await q(db.from('account_families').select('family_id').eq('account_id', userId));
  const famIds = links.map((l) => l.family_id);
  if (!famIds.length) return null;
  const members = await q(db.from('family_members').select('id, gender, birth_date').in('family_id', famIds));
  const records = await q(
    db.from('health_records').select('id, member_id, date, type, weight, bmi, sys, dia, fasting, created_at')
      .in('member_id', members.map((m) => m.id)).order('date'),
  );
  const profile = await q(db.from('dash_profile').select('health_member_id').eq('user_id', userId).maybeSingle());
  const count = (id) => records.filter((r) => r.member_id === id).length;
  const member =
    members.find((m) => m.id === profile?.health_member_id) ?? [...members].sort((a, b) => count(b.id) - count(a.id))[0];
  if (!member) return null;
  const mine = records.filter((r) => r.member_id === member.id);
  const checkIds = mine.filter((r) => r.type === '검진결과').map((r) => r.id);
  const labs = checkIds.length
    ? await q(db.from('lab_results').select('record_id, category, test_name, value, raw_value, unit, reference_range, is_abnormal').in('record_id', checkIds))
    : [];
  const notes = await q(db.from('dash_health_notes').select('category, content, created_at').eq('user_id', userId).order('created_at'));
  const birth = member.birth_date ? new Date(member.birth_date) : null;
  const now = new Date();
  const age = birth
    ? now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
    : null;
  const gender = member.gender === 'male' ? '남성' : member.gender === 'female' ? '여성' : null;
  // 날짜별 검진 (수치가 있는 것만, 오래된 순)
  const checkups = mine
    .filter((r) => labs.some((l) => l.record_id === r.id))
    .map((r) => ({ date: r.date.slice(0, 10), labs: labs.filter((l) => l.record_id === r.id) }));
  const latest = checkups.at(-1) ?? null;
  return { member, age, gender, notes, checkups, latest, daily: mine.filter((r) => r.type !== '검진결과'), records: mine, labs };
}

const labLine = (l) =>
  `${l.test_name} ${l.value ?? l.raw_value ?? ''}${l.unit ? ` ${l.unit}` : ''}${l.reference_range ? ` (참고 ${l.reference_range})` : ''}${l.is_abnormal ? ' [이상]' : ''}`;

async function runCheckup(userId, force) {
  const ctx = await healthContext(userId);
  if (!ctx) return;
  const { data: row, error } = await db.from('dash_checkup_insights').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  // 데이터 지문: 기록·수치·메모 수와 마지막 변경 시각, 대상 사람
  const latestAt = (arr, k) => arr.reduce((m, x) => (x[k] > m ? x[k] : m), '');
  const stamp = [ctx.member.id, ctx.records.length, latestAt(ctx.records, 'created_at'), ctx.labs.length, ctx.notes.length, latestAt(ctx.notes, 'created_at')].join('|');
  const requested = row?.requested_at && (!row.created_at || row.requested_at > row.created_at);
  if (!force && row?.source_stamp === stamp && !requested) return; // 할 일 없음 (10분마다 조용히 확인)
  log(`[checkup] 분석 시작 (${requested ? '화면에서 요청' : force ? '수동' : '기록 변경'}) 검진 ${ctx.checkups.length}회`);

  // 생활 기록 요약: 최근 4주 주간 리포트 숫자, 최근 체중
  const { data: reports } = await db.from('dash_health_reports').select('week_start, stats').eq('user_id', userId).order('week_start', { ascending: false }).limit(4);
  const { data: weights } = await db.from('dash_body_weights').select('weigh_date, weight_kg').eq('user_id', userId).order('weigh_date', { ascending: false }).limit(10);
  const dailyLines = Object.values(Object.fromEntries(ctx.daily.filter((r) => r.weight || r.sys || r.fasting).map((r) => [r.date.slice(0, 10), r])))
    .slice(-12)
    .map((r) => `${r.date.slice(0, 10)}: ${[r.weight && `체중 ${r.weight}kg`, r.sys && `혈압 ${r.sys}/${r.dia}`, r.fasting && `공복혈당 ${r.fasting}`].filter(Boolean).join(', ')}`);

  const prompt = `너는 건강검진 결과를 일반인에게 설명해 주는 가정의학과 상담가다. 한 사람의 검진 기록 추세를 보고 한국어로 인사이트를 써라.
원칙:
- 진단이나 약 처방은 하지 마라. 수치의 의미, 추세(좋아짐/나빠짐), 생활에서 할 수 있는 일, 의사에게 확인할 것을 말하라.
- 검진 기관·연도마다 검사 이름이 다르다 (예: AST, AST (SGOT), AST(GOT)는 같은 검사). 같은 검사끼리 묶어 추세를 보라.
- [이상]은 검진 기관이 표시한 것이다. 참고치가 없으면 일반적인 성인 기준으로 말하되 단정하지 마라.
- 기록에 없는 것은 지어내지 마라.

이 사람: ${[ctx.gender, ctx.age != null && `만 ${ctx.age}세`].filter(Boolean).join(', ') || '나이·성별 모름'}
${ctx.notes.length ? `본인이 적은 건강 메모:\n${ctx.notes.map((n) => `- [${n.category}] ${n.content}`).join('\n')}\n` : ''}
검진 결과 (오래된 순):
${ctx.checkups.map((c) => `## ${c.date}\n${c.labs.map(labLine).join('\n')}`).join('\n\n') || '없음'}

일상 기록 (Health log 앱):
${dailyLines.join('\n') || '없음'}
대시보드 체중 기록: ${(weights ?? []).map((w) => `${w.weigh_date} ${w.weight_kg}kg`).join(', ') || '없음'}
최근 주간 리포트 숫자: ${(reports ?? []).map((r) => `${r.week_start} 주: 하루 평균 ${r.stats.avg_kcal}kcal(기록 ${r.stats.meal_days}일), 운동 체크 ${r.stats.workout_done}/${r.stats.workout_possible}`).join(' / ') || '없음'}

출력:
- headline: 지금 건강 상태와 추세를 한 문장으로
- items: 주요 주제 4~7개 (예: 체중·복부비만, 혈압, 혈당, 콜레스테롤, 간기능, 신장기능, 빈혈). 각 topic(짧은 이름), status(good=양호 / watch=주의해서 지켜볼 것 / concern=관리나 진료 상담이 필요), text(최근 수치와 추세를 1~2문장)
- lifestyle: 검진 결과와 최근 생활 기록(식단·운동·체중)을 연결한 2~3문장
- recommendations: 생활에서 해볼 것 3~5개 (구체적으로)
- ask_doctor: 다음 진료·검진 때 확인할 것 0~3개`;

  const insight = await gemini(prompt, {
    type: 'OBJECT',
    properties: {
      headline: { type: 'STRING' },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { topic: { type: 'STRING' }, status: { type: 'STRING', enum: ['good', 'watch', 'concern'] }, text: { type: 'STRING' } },
          required: ['topic', 'status', 'text'],
        },
      },
      lifestyle: { type: 'STRING' },
      recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
      ask_doctor: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['headline', 'items', 'lifestyle', 'recommendations', 'ask_doctor'],
  });
  const { error: e2 } = await db.from('dash_checkup_insights').upsert(
    { user_id: userId, member_id: ctx.member.id, insight, source_stamp: stamp, created_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (e2) throw e2;
  log(`[checkup] 저장: ${insight.headline}`);
}

// ---------- 주간 건강 리포트 ----------
// 지난 월~일 식단·운동·체중을 모아 숫자는 직접 계산하고, 평가와 조언은 Gemini가 쓴다.
async function runHealth(userId, weekArg) {
  const addD = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
  const today = todaySeoul();
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일 … 1=월
  const thisMonday = addD(today, -((wd + 6) % 7));
  const weekStart = weekArg || addD(thisMonday, -7); // 기본: 가장 최근에 끝난 월~일
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1) {
    throw new Error(`--week 는 월요일 날짜여야 합니다 (예: 2026-11-09)`);
  }
  const weekEnd = addD(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addD(weekStart, i));
  const elapsed = days.filter((d) => d <= today).length; // 진행 중인 주를 --week 로 만들 때 아직 안 온 날은 빼고 본다

  await runMeals(userId); // 일요일 밤 늦게 적은 식단까지 분석해 두기

  const q = async (p) => {
    const { data, error } = await p;
    if (error) throw error;
    return data;
  };
  const [meals, items, logs, profile, weights] = await Promise.all([
    q(db.from('dash_meals').select('meal_date, meal_type, description, kcal, food_name, ai_kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', userId).gte('meal_date', weekStart).lte('meal_date', weekEnd).order('meal_date').order('created_at')),
    q(db.from('dash_workout_items').select('id, name, time_label, active').eq('user_id', userId)),
    q(db.from('dash_workout_logs').select('item_id, log_date, done').eq('user_id', userId).eq('done', true)
      .gte('log_date', weekStart).lte('log_date', weekEnd)),
    q(db.from('dash_profile').select('height_cm').eq('user_id', userId).maybeSingle()),
    q(db.from('dash_body_weights').select('weigh_date, weight_kg').eq('user_id', userId)
      .gte('weigh_date', addD(weekStart, -28)).lte('weigh_date', weekEnd).order('weigh_date')),
  ]);

  // 숫자 계산 (AI에게 맡기지 않음)
  const r1 = (n) => Math.round(n * 10) / 10;
  const perDay = days.map((date) => {
    const ms = meals.filter((m) => m.meal_date === date);
    const sum = (k) => ms.reduce((t, m) => t + Number(m[k] ?? 0), 0);
    return {
      date,
      meals: ms.length,
      kcal: ms.reduce((t, m) => t + (m.kcal ?? m.ai_kcal ?? 0), 0),
      protein_g: r1(sum('protein_g')),
      carbs_g: r1(sum('carbs_g')),
      fat_g: r1(sum('fat_g')),
      workouts: logs.filter((l) => l.log_date === date).length,
    };
  });
  const mealDays = perDay.filter((d) => d.meals > 0);
  const avg = (k) => (mealDays.length ? Math.round(mealDays.reduce((t, d) => t + d[k], 0) / mealDays.length) : 0);
  const pk = avg('protein_g') * 4, ck = avg('carbs_g') * 4, fk = avg('fat_g') * 9, mk = pk + ck + fk;
  const activeItems = items.filter((i) => i.active);
  const doneById = Object.fromEntries(activeItems.map((i) => [i.id, logs.filter((l) => l.item_id === i.id).length]));
  const doneTotal = Object.values(doneById).reduce((a, b) => a + b, 0);
  const height = profile?.height_cm ? Number(profile.height_cm) : null;
  const inWeek = weights.filter((w) => w.weigh_date >= weekStart);
  const latest = weights.at(-1) ?? null;
  const stats = {
    week_start: weekStart,
    week_end: weekEnd,
    meal_days: mealDays.length,
    meal_count: meals.length,
    avg_kcal: avg('kcal'),
    avg_protein_g: avg('protein_g'),
    avg_carbs_g: avg('carbs_g'),
    avg_fat_g: avg('fat_g'),
    macro_pct: mk ? { p: Math.round((pk / mk) * 100), c: Math.round((ck / mk) * 100), f: Math.round((fk / mk) * 100) } : null,
    skipped_breakfast: mealDays.filter((d) => !meals.some((m) => m.meal_date === d.date && m.meal_type === 'breakfast')).length,
    workout_days: perDay.filter((d) => d.workouts > 0).length,
    workout_done: doneTotal,
    workout_possible: activeItems.length * elapsed,
    workout_items: activeItems.map((i) => ({ name: i.name, done: doneById[i.id] })),
    height_cm: height,
    weight_start: inWeek[0] ? Number(inWeek[0].weight_kg) : null,
    weight_end: inWeek.at(-1) ? Number(inWeek.at(-1).weight_kg) : null,
    weight_latest: latest ? Number(latest.weight_kg) : null,
    bmi: height && latest ? r1(Number(latest.weight_kg) / (height / 100) ** 2) : null,
    days: perDay,
  };
  const ctx = await healthContext(userId).catch(() => null);
  log(`[health] ${weekStart} ~ ${weekEnd}: 식단 ${stats.meal_days}일·${stats.meal_count}끼, 운동 ${doneTotal}/${stats.workout_possible}, 체중 ${inWeek.length}회`);
  if (meals.length === 0 && logs.length === 0 && inWeek.length === 0) {
    log('[health] 이번 주 기록이 없어 건너뜀');
    return;
  }

  const W = ['일', '월', '화', '수', '목', '금', '토'];
  const dayLabel = (d) => `${d.slice(5)}(${W[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
  const mealLines = days.map((date) => {
    const ms = meals.filter((m) => m.meal_date === date);
    const d = perDay.find((x) => x.date === date);
    if (date > today) return `${dayLabel(date)}: (아직 오지 않은 날)`;
    if (!ms.length) return `${dayLabel(date)}: 기록 없음`;
    const list = ms.map((m) => `${MEAL_LABEL[m.meal_type]} ${m.food_name || m.description}${(m.kcal ?? m.ai_kcal) != null ? ` ${m.kcal ?? m.ai_kcal}kcal` : ''}`).join(' / ');
    return `${dayLabel(date)}: ${list}  → 합계 ${d.kcal}kcal, 단${d.protein_g} 탄${d.carbs_g} 지${d.fat_g}g`;
  });
  const workoutLines = days.map((date) => {
    const done = logs.filter((l) => l.log_date === date).map((l) => items.find((i) => i.id === l.item_id)?.name).filter(Boolean);
    return `${dayLabel(date)}: ${date > today ? '(아직 오지 않은 날)' : done.length ? done.join(', ') : '-'}`;
  });

  const prompt = `너는 영양사이자 운동 코치다. 한 사람의 지난 1주일(${weekStart} ~ ${weekEnd}) 기록을 보고 한국어로 주간 평가를 써라.
원칙:
- 숫자는 아래 '계산된 값'을 그대로 쓰고 새로 지어내지 마라. 칼로리·영양소는 AI 추정치라 오차가 있다는 점을 감안해 단정하지 마라.
- 기록이 없는 날은 '안 먹음/안 함'이 아니라 '기록 없음'으로 취급하고, 기록이 적으면 그만큼 조심스럽게 평가하라.
${elapsed < 7 ? `- 이 주는 아직 진행 중이다 (${elapsed}일 지남). '아직 오지 않은 날'은 평가에서 빼라.\n` : ''}- 나이·성별처럼 모르는 정보는 가정하지 말고 필요하면 범위로 말하라. 진단·약물 같은 의학적 판단은 하지 마라.
- 조언은 다음 주에 바로 해볼 수 있게 구체적으로 (어느 끼니에 무엇을 얼마나 바꿀지).
${ENV.MEAL_CONTEXT ? `참고할 이 사람의 상황: ${ENV.MEAL_CONTEXT}\n` : ''}${ctx ? `이 사람: ${[ctx.gender, ctx.age != null && `만 ${ctx.age}세`].filter(Boolean).join(', ') || '나이·성별 모름'}\n` : ''}${ctx?.notes.length ? `본인이 적은 건강 메모: ${ctx.notes.map((n) => `[${n.category}] ${n.content}`).join(' / ')}\n` : ''}${ctx?.latest ? `최근 검진(${ctx.latest.date})에서 이상 표시된 항목: ${ctx.latest.labs.filter((l) => l.is_abnormal).map(labLine).join(', ') || '없음'} — 식단·운동 조언에 반영하되 진단은 하지 마라.\n` : ''}
계산된 값:
- 식단 기록 ${stats.meal_days}일, ${stats.meal_count}끼 / 기록한 날 하루 평균 ${stats.avg_kcal}kcal, 단백질 ${stats.avg_protein_g}g, 탄수화물 ${stats.avg_carbs_g}g, 지방 ${stats.avg_fat_g}g${stats.macro_pct ? ` (열량 비율 단${stats.macro_pct.p}% 탄${stats.macro_pct.c}% 지${stats.macro_pct.f}%)` : ''}
- 아침 기록이 없는 날: 식단 기록한 ${stats.meal_days}일 중 ${stats.skipped_breakfast}일
- 운동 루틴 체크 ${doneTotal}회 / 가능 ${stats.workout_possible}회 (운동한 날 ${stats.workout_days}일)
- 항목별 체크 횟수: ${stats.workout_items.map((i) => `${i.name} ${i.done}회`).join(', ') || '루틴 없음'}
- 키 ${height ?? '모름'}cm, 최근 체중 ${stats.weight_latest ?? '기록 없음'}kg${stats.bmi ? `, BMI ${stats.bmi}` : ''}
- 최근 4주 체중 기록: ${weights.map((w) => `${w.weigh_date.slice(5)} ${w.weight_kg}kg`).join(', ') || '없음'}

날짜별 식단:
${mealLines.join('\n')}

날짜별 운동 체크:
${workoutLines.join('\n')}

출력:
- headline: 이번 주 핵심 평가를 한 문장으로 (날짜나 '주간 평가' 같은 제목 형식 말고, 무엇이 좋았고 무엇이 아쉬웠는지)
- diet: 식단 구성 평가 3~5문장 (열량 수준, 탄단지 균형, 끼니 규칙성, 채소·단백질 공급원·가공식품 등 음식 구성)
- exercise: 운동 평가 2~4문장 (빈도, 꾸준함, 빠진 항목)
- body: 키·체중·BMI에 대한 2~3문장 (체중 기록이 없으면 기록을 권하는 한 문장)
- good: 잘한 점 2~3개 (각 한 문장)
- adjust: 조절하면 좋을 부분 2~4개 (각 한 문장, 구체적으로)
- next_week: 다음 주 목표 2~3개 (짧고 확인 가능하게)`;

  const list = { type: 'ARRAY', items: { type: 'STRING' } };
  const report = await gemini(prompt, {
    type: 'OBJECT',
    properties: { headline: { type: 'STRING' }, diet: { type: 'STRING' }, exercise: { type: 'STRING' }, body: { type: 'STRING' }, good: list, adjust: list, next_week: list },
    required: ['headline', 'diet', 'exercise', 'body', 'good', 'adjust', 'next_week'],
  });
  const { error } = await db
    .from('dash_health_reports')
    .upsert({ user_id: userId, week_start: weekStart, stats, report, created_at: new Date().toISOString() }, { onConflict: 'user_id,week_start' });
  if (error) throw error;
  log(`[health] 저장: ${report.headline}`);
}

// ---------- 실행 ----------
const cmd = process.argv[2] || 'all';
try {
  if (cmd === 'collect') {
    await runCollect();
  } else {
    const userId = DRY ? null : await resolveUserId();
    if ((cmd === 'meals' || cmd === 'all') && !DRY) await runMeals(userId);
    if (cmd === 'news' || cmd === 'all') await runNews(userId);
    if ((cmd === 'market' || cmd === 'all') && !DRY) await runMarket(userId, process.argv.includes('--missing'));
    if (cmd === 'checkup' && !DRY) await runCheckup(userId, process.argv.includes('--force'));
    if (cmd === 'health' && !DRY) {
      const i = process.argv.indexOf('--week');
      await runHealth(userId, i > 0 ? process.argv[i + 1] : null);
    }
  }
  if (!(cmd === 'market' && process.argv.includes('--missing')) && !(cmd === 'checkup' && !process.argv.includes('--force'))) log('[done]', cmd);
} catch (e) {
  console.error(new Date().toISOString(), '[error]', e.message);
  process.exit(1);
}
