// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룬다 (Postgres date 컬럼과 동일 형식).

const TZ = 'Asia/Seoul';

/** Asia/Seoul 기준 오늘 날짜 */
export function todaySeoul(now: Date = new Date()): string {
  // en-CA 로케일은 YYYY-MM-DD 형식으로 출력된다.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 날짜 문자열에 n일 더하기 (음수 가능). 타임존 영향이 없도록 UTC로 계산한다. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** end를 포함해 과거 n일 목록 (오래된 날짜 → 최근 순) */
export function lastNDays(n: number, end: string = todaySeoul()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '11월 12일 (목)' 형식 */
export function formatKoreanDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEKDAYS[wd]})`;
}

/** 요일 한 글자 */
export function weekdayKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 그 달 1일 ('YYYY-MM-01') */
export function monthStart(date: string): string {
  return date.slice(0, 8) + '01';
}

/** 그 달 마지막 날 */
export function monthEnd(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** n개월 더한 달의 1일 */
export function addMonths(date: string, n: number): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** 달력 칸: 일요일 시작, 앞뒤 달 날짜 포함해 주 단위로 채운다. */
export function calendarCells(month: string): string[] {
  const first = monthStart(month);
  const [y, m] = first.split('-').map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = monthEnd(first);
  const total = Math.ceil((lead + Number(last.slice(8))) / 7) * 7;
  return Array.from({ length: total }, (_, i) => addDays(first, i - lead));
}

/** '2026년 11월' */
export function formatMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${y}년 ${m}월`;
}
