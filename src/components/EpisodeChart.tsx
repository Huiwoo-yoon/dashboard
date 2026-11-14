import { useLayoutEffect, useRef, useState } from 'react';
import type { Episode, MedLog, SymptomLog } from '../api/episodes';

const DAY = 86400000;
const seoulDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const t = (d: string) => Date.parse(`${d}T00:00:00+09:00`);

/** 증상 강도(선)와 약 복용 기간(막대)을 같은 날짜 축에 */
export function EpisodeChart({ episode, symptoms, meds, today }: { episode: Episode; symptoms: SymptomLog[]; meds: MedLog[]; today: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  // 화면에 맞춰 잰 너비. 재기 전에는 그리지 않는다 (임의의 너비로 그리면 폰에서 페이지가 넓어져 전체가 축소됨)
  const [measured, setWidth] = useState<number | null>(null);
  const width = Math.max(240, measured ?? 0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = [
    episode.start_date,
    episode.end_date ?? today,
    ...symptoms.map((s) => seoulDay(s.logged_at)),
    ...meds.flatMap((m) => [m.start_date, m.end_date ?? (episode.end_date ? m.start_date : today)]),
  ].sort();
  const from = t(days[0]);
  const to = Math.max(t(days[days.length - 1]) + DAY, from + 3 * DAY);
  const L = 28, R = 12, TOP = 12, SEV_H = 120, BAR = 18, GAP = 6;
  const medTop = TOP + SEV_H + 30;
  const H = medTop + meds.length * (BAR + GAP) + (meds.length ? 4 : 0);
  const x = (ms: number) => L + ((ms - from) / (to - from)) * (width - L - R);
  const y = (sev: number) => TOP + (1 - sev / 10) * SEV_H;
  const pts = symptoms.map((s) => ({ s, cx: x(Date.parse(s.logged_at)), cy: y(s.severity) }));
  // 날짜 눈금: 하루 단위로 맞추고 겹치지 않게 (최대 5개)
  const nDays = Math.round((to - from) / DAY);
  const step = Math.max(1, Math.ceil((nDays - 1) / 4));
  const ticks = Array.from({ length: Math.floor((nDays - 1) / step) + 1 }, (_, k) => from + k * step * DAY);

  return (
    <div className="chart" ref={wrap} style={{ height: H }}>
      {measured != null && measured > 0 && (
      <svg width={width} height={H} role="img" aria-label="증상 강도와 복용 약 추이">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={width - R} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">{v}</text>
          </g>
        ))}
        {ticks.map((ms, i) => (
          <text key={i} x={x(ms + DAY / 2)} y={TOP + SEV_H + 18} textAnchor="middle" className="chart-axis">
            {md(seoulDay(new Date(ms).toISOString()))}
          </text>
        ))}
        {pts.length > 1 && <polyline points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={2} />}
        {pts.map(({ s, cx, cy }) => (
          <circle key={s.id} cx={cx} cy={cy} r={4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2}>
            <title>{`${seoulDay(s.logged_at)} 강도 ${s.severity}/10 · ${s.symptoms.join(', ')}`}</title>
          </circle>
        ))}
        {meds.map((m, i) => {
          const end = m.end_date ? t(m.end_date) + DAY : episode.end_date ? t(m.start_date) + DAY : t(today) + DAY;
          const x1 = x(t(m.start_date));
          const w = Math.max(6, x(end) - x1);
          const top = medTop + i * (BAR + GAP);
          return (
            <g key={m.id}>
              <rect x={x1} y={top} width={w} height={BAR} rx={3} className={`med-bar${m.end_date ? '' : ' ongoing'}`}>
                <title>{`${m.medication_name} ${m.dosage ?? ''} · ${m.start_date} ~ ${m.end_date ?? '복용 중'}`}</title>
              </rect>
              <text x={Math.min(x1 + 6, width - R - 4)} y={top + 13} className="med-label">{m.medication_name}</text>
            </g>
          );
        })}
      </svg>
      )}
    </div>
  );
}
