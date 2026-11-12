import { useEffect, useRef, useState } from 'react';
import type { Point, RangeKey } from '../api/market';

const H = 280;
const PAD = { top: 52, right: 64, bottom: 26, left: 8 }; // 위쪽 여백 = 툴팁 자리

const seoul = (sec: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opts }).format(new Date(sec * 1000));

/** 축 눈금용 짧은 날짜 */
function tickLabel(sec: number, range: RangeKey): string {
  if (range === '1d') return seoul(sec, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (range === '5d' || range === '1mo') return seoul(sec, { month: 'numeric', day: 'numeric' });
  if (range === '1y') return seoul(sec, { year: '2-digit', month: 'numeric' });
  return seoul(sec, { year: 'numeric' });
}

/** 툴팁용 자세한 날짜 */
function tipLabel(sec: number, range: RangeKey): string {
  if (range === '1d' || range === '5d') return seoul(sec, { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  if (range === 'max' || range === '5y') return seoul(sec, { year: 'numeric', month: 'long' });
  return seoul(sec, { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
}

/** 단일 시리즈 선 차트. x는 거래 시점 순서(장 마감 시간의 빈 구간 없이), 호버/터치로 값 확인 */
export function LineChart({
  points,
  range,
  color,
  format,
  label,
}: {
  points: Point[];
  range: RangeKey;
  color: string;
  format: (v: number) => string;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setHover(null), [points]);

  if (points.length < 2) return <div className="chart-empty muted small">표시할 데이터가 없습니다</div>;

  const vals = points.map((p) => p[1]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) * 0.01 || 1;
  lo -= span * 0.06;
  hi += span * 0.06;
  const iw = width - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');

  const yTicks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * (k + 0.5)) / 4);
  const xTicks = [0, 1, 2, 3].map((k) => Math.round((k / 3) * (points.length - 1)));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const hp = hover != null ? points[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 70), width - 70) : 0;

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={H} role="img" aria-label={`${label} 추이: ${format(vals[0])}에서 ${format(vals[vals.length - 1])}`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left + iw + 8} y={y(v)} dy="0.32em" className="chart-axis">{format(v)}</text>
          </g>
        ))}
        {xTicks.map((i, k) => (
          <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 3 ? 'end' : 'middle'} className="chart-axis">
            {tickLabel(points[i][0], range)}
          </text>
        ))}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hp && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="chart-cross" />
            <circle cx={x(hover)} cy={y(hp[1])} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={PAD.left}
          y={0}
          width={iw}
          height={H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: tipLeft }}>
          <div className="v">{format(hp[1])}</div>
          <div className="t">{tipLabel(hp[0], range)}</div>
        </div>
      )}
    </div>
  );
}
