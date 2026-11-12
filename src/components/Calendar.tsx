import { addMonths, calendarCells, formatMonth, todaySeoul } from '../lib/date';
import { Icon } from './Icon';

export interface DayMark {
  /** 0~1: 칸을 진하게 칠하는 정도 (달성률 등) */
  level?: number;
  /** 작은 점 표시 (기록 있음) */
  dot?: boolean;
  /** 날짜 아래 작은 글자 (예: 1.8k) */
  label?: string;
  /** 경고색 점 (기한 지남 등) */
  alert?: boolean;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 월 달력. 날짜를 누르면 onSelect, 달을 넘기면 onMonthChange. */
export function Calendar({
  month,
  selected,
  marks,
  onSelect,
  onMonthChange,
}: {
  month: string;
  selected: string;
  marks: Record<string, DayMark>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  const today = todaySeoul();
  const cells = calendarCells(month);
  const ym = month.slice(0, 7);

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="이전 달">
          <Icon name="left" size={18} />
        </button>
        <strong>{formatMonth(month)}</strong>
        <button className="icon-btn" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="다음 달">
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="cal-grid">
        {WEEK.map((w, i) => (
          <div key={w} className={`cal-week ${i === 0 ? 'sun' : ''}`}>{w}</div>
        ))}
        {cells.map((d) => {
          const mk = marks[d];
          const level = mk?.level ?? 0;
          const cls = [
            'cal-day',
            d.slice(0, 7) !== ym && 'out',
            d === today && 'today',
            d === selected && 'selected',
            level >= 1 && 'full',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={d}
              className={cls}
              onClick={() => onSelect(d)}
              style={level > 0 && level < 1 ? { ['--lv' as string]: String(0.12 + level * 0.45) } : undefined}
              aria-label={d}
              aria-pressed={d === selected}
            >
              <span className="cal-num">{Number(d.slice(8))}</span>
              {mk?.label ? <span className="cal-label">{mk.label}</span> : mk?.dot || mk?.alert ? <span className={`cal-dot ${mk.alert ? 'alert' : ''}`} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
