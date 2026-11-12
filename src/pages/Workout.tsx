import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addItem,
  archiveItem,
  listActiveItems,
  listLogs,
  saveOrder,
  setLog,
  updateItem,
  type WorkoutItem,
  type WorkoutItemInput,
  type WorkoutLog,
} from '../api/workouts';
import { addDays, formatKoreanDate, lastNDays, monthEnd, monthStart, todaySeoul, weekdayKo } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { Calendar, type DayMark } from '../components/Calendar';
import { Icon } from '../components/Icon';

const HISTORY_DAYS = 14;
const EMPTY: WorkoutItemInput = { name: '', time_label: '', place: '', note: '' };

/** 서울 기준 오늘 날짜. 자정이 지나거나 앱으로 돌아오면 자동 갱신 → 새 체크리스트. */
function useSeoulToday(): string {
  const [today, setToday] = useState(todaySeoul());
  useEffect(() => {
    const check = () => setToday(todaySeoul());
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

const clean = (v: WorkoutItemInput): WorkoutItemInput => ({
  name: v.name.trim(),
  time_label: v.time_label?.trim() || null,
  place: v.place?.trim() || null,
  note: v.note?.trim() || null,
});

export default function Workout() {
  const today = useSeoulToday();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthStart(today));
  const [items, setItems] = useState<WorkoutItem[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkoutItemInput>(EMPTY);

  // 날짜가 바뀌면(자정) 선택도 오늘로
  useEffect(() => setSelected(today), [today]);

  // 달력에 보이는 달 + 최근 14일을 모두 덮는 범위의 기록을 불러온다
  const from = [monthStart(month), addDays(today, -(HISTORY_DAYS - 1))].sort()[0];
  const to = [monthEnd(month), today].sort()[1];

  const load = useCallback(async () => {
    try {
      const [its, lgs] = await Promise.all([listActiveItems(), listLogs(from, to)]);
      setItems(its);
      setLogs(lgs);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const doneSet = useMemo(
    () => new Set(logs.filter((l) => l.done).map((l) => `${l.item_id}|${l.log_date}`)),
    [logs],
  );
  const isDone = (itemId: string, date: string) => doneSet.has(`${itemId}|${date}`);
  const rateOf = (date: string) =>
    items.length === 0 ? 0 : items.filter((i) => isDone(i.id, date)).length / items.length;

  const isFuture = selected > today;

  async function toggle(item: WorkoutItem) {
    if (isFuture) return;
    const next = !isDone(item.id, selected);
    const prev = logs;
    setLogs((ls) => [...ls.filter((l) => !(l.item_id === item.id && l.log_date === selected)), { item_id: item.id, log_date: selected, done: next }]);
    try {
      await setLog(item.id, selected, next);
    } catch (e) {
      setLogs(prev);
      setError(errMsg(e));
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const v = clean(draft);
    if (!v.name) return;
    try {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const it = await addItem(v, nextOrder);
      setItems((list) => [...list, it]);
      setDraft(EMPTY);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onSaveItem(item: WorkoutItem, v: WorkoutItemInput) {
    const c = clean(v);
    if (!c.name) return;
    try {
      const updated = await updateItem(item.id, c);
      setItems((list) => list.map((i) => (i.id === item.id ? updated : i)));
      setEditingId(null);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next.map((it, i) => ({ ...it, sort_order: i })));
    try {
      await saveOrder(next.map((it) => it.id));
    } catch (err) {
      setError(errMsg(err));
      load();
    }
  }

  async function remove(item: WorkoutItem) {
    if (!confirm(`"${item.name}" 항목을 루틴에서 뺄까요? (지난 기록은 남습니다)`)) return;
    try {
      await archiveItem(item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const days = lastNDays(HISTORY_DAYS, today);
  const avg = Math.round((days.reduce((s, d) => s + rateOf(d), 0) / days.length) * 100);
  let streak = 0; // 모든 항목을 끝낸 날이 오늘(또는 어제)부터 며칠 이어졌는지
  for (let i = days.length - 1; i >= 0; i--) {
    if (rateOf(days[i]) === 1) streak++;
    else if (days[i] === today) continue;
    else break;
  }
  const doneSelected = items.filter((i) => isDone(i.id, selected)).length;
  const doneToday = items.filter((i) => isDone(i.id, today)).length;

  const marks: Record<string, DayMark> = {};
  for (let d = monthStart(month); d <= monthEnd(month) && d <= today; d = addDays(d, 1)) {
    const r = rateOf(d);
    if (r > 0) marks[d] = { level: r };
  }

  return (
    <div>
      <PageHeader
        eyebrow={formatKoreanDate(today)}
        title="운동"
        subtitle="달력에서 날짜를 누르면 그날의 체크리스트가 보입니다"
        right={
          <button className={`btn ${managing ? 'primary' : ''}`} onClick={() => { setManaging((v) => !v); setEditingId(null); }}>
            <Icon name="edit" size={16} /> {managing ? '편집 완료' : '루틴 편집'}
          </button>
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="stats">
        <StatTile icon="check" label="오늘" value={<>{doneToday}<small>/ {items.length}</small></>} foot={items.length && doneToday === items.length ? <span className="up">모두 완료</span> : '완료한 항목'} />
        <StatTile icon="activity" label="14일 평균" value={<>{avg}<small>%</small></>} foot="일별 달성률 평균" />
        <StatTile icon="calendar" label="연속 달성" value={<>{streak}<small>일</small></>} foot="전부 끝낸 날 연속" />
        <StatTile icon="grid" label="루틴 항목" value={items.length} foot="현재 사용 중" />
      </div>

      <div className="day-layout">
        <div className="day-side">
          <Panel>
            <Calendar
              month={month}
              selected={selected}
              marks={marks}
              onSelect={(d) => { setSelected(d); setMonth(monthStart(d)); }}
              onMonthChange={setMonth}
            />
            <p className="panel-note">진할수록 그날 많이 했습니다 · 검정 = 전부 완료</p>
          </Panel>
          <Panel title="최근 14일" subtitle="날짜별 달성률 (현재 항목 기준)">
            <div className="history-bars" aria-label="최근 14일 달성률">
              {days.map((d) => {
                const r = rateOf(d);
                return (
                  <button key={d} className={`bar-col ${d === today ? 'is-today' : ''}`} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} title={`${formatKoreanDate(d)} ${Math.round(r * 100)}%`} onClick={() => { setSelected(d); setMonth(monthStart(d)); }}>
                    <div className="bar-track">
                      <div className={`bar-fill ${r === 1 ? 'full' : ''}`} style={{ height: `${r * 100}%` }} />
                    </div>
                    <span className="bar-label">{weekdayKo(d)}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel
          flush
          title={managing ? '루틴 편집' : selected === today ? `오늘의 루틴 · ${formatKoreanDate(selected)}` : formatKoreanDate(selected)}
          subtitle={
            managing
              ? '항목을 누르면 시간대·장소·핵심 포인트를 고칠 수 있습니다'
              : isFuture
                ? '아직 오지 않은 날은 체크할 수 없습니다'
                : `${doneSelected}/${items.length} 완료 · 눌러서 체크`
          }
        >
          {managing && (
            <form className="add-form" onSubmit={onAdd} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <ItemFields value={draft} onChange={setDraft} />
              <div className="row">
                <span style={{ flex: 1 }} />
                <button className="btn primary" disabled={!draft.name.trim()}><Icon name="plus" size={18} /> 항목 추가</button>
              </div>
            </form>
          )}

          {!loading && items.length === 0 ? (
            <EmptyState>
              루틴 항목이 없습니다.
              {!managing && <button className="btn primary" onClick={() => setManaging(true)}>루틴 만들기</button>}
            </EmptyState>
          ) : (
            <ul className="list">
              {items.map((item, i) =>
                managing ? (
                  editingId === item.id ? (
                    <li key={item.id} className="list-item editing">
                      <ItemEditor item={item} onCancel={() => setEditingId(null)} onSave={(v) => onSaveItem(item, v)} />
                    </li>
                  ) : (
                    <li key={item.id} className="list-item">
                      <button className="item-main" onClick={() => setEditingId(item.id)} aria-label="수정">
                        <SlotText item={item} />
                      </button>
                      <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로"><Icon name="up" size={18} /></button>
                      <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="아래로"><Icon name="down" size={18} /></button>
                      <button className="icon-btn" onClick={() => remove(item)} aria-label="삭제"><Icon name="trash" size={18} /></button>
                    </li>
                  )
                ) : (
                  <li key={item.id} className={`list-item ${isDone(item.id, selected) ? 'done' : ''}`}>
                    <button className="check-row slot" onClick={() => toggle(item)} disabled={isFuture}>
                      <span className={`check ${isDone(item.id, selected) ? 'on' : ''}`}>{isDone(item.id, selected) ? '✓' : ''}</span>
                      <SlotText item={item} />
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function SlotText({ item }: { item: WorkoutItem }) {
  return (
    <span className="item-body">
      {(item.time_label || item.place) && (
        <span className="slot-meta">
          {item.time_label && <span className="time">{item.time_label}</span>}
          {item.place && <span>· {item.place}</span>}
        </span>
      )}
      <span className="item-title">{item.name}</span>
      {item.note && <span className="slot-note">{item.note}</span>}
    </span>
  );
}

function ItemFields({ value, onChange }: { value: WorkoutItemInput; onChange: (v: WorkoutItemInput) => void }) {
  const set = (k: keyof WorkoutItemInput) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="field-grid">
      <input placeholder="시간대 (예: 07:30 출근 전)" value={value.time_label ?? ''} onChange={set('time_label')} maxLength={50} />
      <input placeholder="장소 (예: 집, 사무실)" value={value.place ?? ''} onChange={set('place')} maxLength={50} />
      <input className="wide" placeholder="운동 내용 (예: 맨몸 푸시업 15개 + 스쿼트 15개)" value={value.name} onChange={set('name')} maxLength={200} />
      <textarea className="wide" placeholder="핵심 포인트 (선택)" value={value.note ?? ''} onChange={set('note')} maxLength={1000} />
    </div>
  );
}

function ItemEditor({ item, onCancel, onSave }: { item: WorkoutItem; onCancel: () => void; onSave: (v: WorkoutItemInput) => void }) {
  const [v, setV] = useState<WorkoutItemInput>({ name: item.name, time_label: item.time_label, place: item.place, note: item.note });
  return (
    <form className="edit-form" onSubmit={(e) => { e.preventDefault(); onSave(v); }}>
      <ItemFields value={v} onChange={setV} />
      <div className="row">
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={!v.name.trim()}>저장</button>
      </div>
    </form>
  );
}
