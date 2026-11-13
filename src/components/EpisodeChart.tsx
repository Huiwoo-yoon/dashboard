import { useEffect, useRef, useState } from 'react';
import type { Episode, MedLog, SymptomLog } from '../api/episodes';

const DAY = 86400000;
const seoulDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const t = (d: string) => Date.parse(`${d}T00:00:00+09:00`);

/** 증상 강도(선)와 약 복용 기간(막대)을 같은 날짜 축에 */
export function EpisodeChart({ episode, symptoms, meds, today }: { episode: Episode; symptoms: SymptomLog[]; meds: MedLog[]; today: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
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
  const ticks = [0, 1, 2, 3].map((k) => from + ((to - from - DAY) * k) / 3);

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={H} role="img" aria-label="증상 강도와 복용 약 추이">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={width - R} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">{v}</text>
          </g>
        ))}
        {ticks.map((ms, i) => (
          <text key={i} x={x(ms)} y={TOP + SEV_H + 18} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} className="chart-axis">
            {md(new Date(ms).toISOString().slice(0, 10))}
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
    </div>
  );
}
