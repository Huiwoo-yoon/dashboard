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
