#!/usr/bin/env node
// 맥미니에서 매일 실행하는 로컬 작업 (launchd가 호출)
//   node scripts/daily.mjs meals   식단 AI 분석 (칼로리·탄단지·하루 인사이트)
//   node scripts/daily.mjs collect 뉴스 제목만 로컬에 모아 두기 (매일, 화면 표시 없음)
//   node scripts/daily.mjs news    지난주 월~일 주간 소식 정리 (매주 월요일)
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
// 매주 월요일에 지난주 월~일 기사를 분야별로 정리한다(news).
const CATEGORIES = ['경제', '문화', '세계', '과학', '의학', 'IT', '생활'];
const CACHE = join(here, 'news-cache.json'); // git 제외
const DAY = 86400 * 1000;

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

async function fetchFeed({ source, hint, url }) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal RSS reader)' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    return blocks.slice(0, 40).map((b) => {
      const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
      const date = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'dc:date');
      const t = date ? Date.parse(date) : NaN;
      return { source, hint, title: tag(b, 'title'), url: tag(b, 'link') || atomLink || '', published_at: isNaN(t) ? null : new Date(t).toISOString() };
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

/** 매주: 지난주 월~일 기사를 분야별 5~10개로 정리해 저장 (digest_date = 지난주 월요일) */
async function runNews(userId) {
  await runCollect();
  if (DRY) return;
  // 가장 최근에 끝난 한 주: 지난주 월요일 00:00 ~ 이번 주 월요일 00:00 (서울 기준)
  const today = todaySeoul();
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
  const thisMonday = ymd(Date.parse(`${today}T00:00:00Z`) - ((wd + 6) % 7) * DAY);
  const weekStart = ymd(Date.parse(`${thisMonday}T00:00:00Z`) - 7 * DAY);
  const start = Date.parse(`${weekStart}T00:00:00+09:00`);
  const end = Date.parse(`${thisMonday}T00:00:00+09:00`);
  const all = readCache().filter((i) => {
    const t = Date.parse(i.published_at ?? i.collected_at);
    return t >= start && t < end;
  });
  log(`[news] ${weekStart}(월) ~ ${ymd(end - DAY)}(일), 후보 ${all.length}개`);
  if (all.length === 0) return;

  const schema = {
    type: 'OBJECT',
    properties: {
      headline: { type: 'STRING' },
      picks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { index: { type: 'INTEGER' }, title: { type: 'STRING' }, note: { type: 'STRING' } },
          required: ['index', 'title', 'note'],
        },
      },
    },
    required: ['headline', 'picks'],
  };

  const items = [];
  const lines = [];
  for (const cat of CATEGORIES) {
    const pool = all.filter((i) => i.hint === cat);
    if (pool.length === 0) continue;
    const list = pool.map((i, n) => `${n}. [${i.source}] ${i.title}`).join('\n');
    const prompt = `아래는 지난 1주일 동안 "${cat}" 분야 매체에서 모은 기사 제목이다. 디지털 디톡스 중이라 뉴스를 일주일에 한 번만 보는 사람을 위해 이번 주 "${cat}" 분야에서 꼭 알아둘 만한 주요 뉴스를 골라라.
- picks: 5~10개. 같은 사건의 중복 기사는 하나만. 자극적·가십성·단순 사건사고보다 의미 있는 흐름과 큰 사건 위주.
  - title: 한국어로 다듬은 제목 (영어 기사도 한국어로)
  - note: 무슨 일인지 한국어 한 문장 설명
- headline: 이번 주 "${cat}" 분야를 한 문장으로 요약

${list}`;
    try {
      const out = await gemini(prompt, schema);
      const picks = out.picks.filter((p) => pool[p.index]).slice(0, 10);
      for (const p of picks) {
        const a = pool[p.index];
        items.push({ title: String(p.title).slice(0, 200), url: a.url, source: a.source, published_at: a.published_at, topic: cat, note: String(p.note).slice(0, 300) });
      }
      lines.push(`• ${cat}: ${out.headline}`);
      log(`[news] ${cat}: ${picks.length}개 (후보 ${pool.length})`);
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

// ---------- 실행 ----------
const cmd = process.argv[2] || 'all';
try {
  if (cmd === 'collect') {
    await runCollect();
  } else {
    const userId = DRY ? null : await resolveUserId();
    if ((cmd === 'meals' || cmd === 'all') && !DRY) await runMeals(userId);
    if (cmd === 'news' || cmd === 'all') await runNews(userId);
  }
  log('[done]', cmd);
} catch (e) {
  console.error(new Date().toISOString(), '[error]', e.message);
  process.exit(1);
}
