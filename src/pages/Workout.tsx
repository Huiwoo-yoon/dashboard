import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addItem,
  archiveItem,
  listActiveItems,
  listLogs,
  saveOrder,
  setLog,
  type WorkoutItem,
  type WorkoutLog,
} from '../api/workouts';
import { addDays, formatKoreanDate, lastNDays, todaySeoul, weekdayKo } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

const HISTORY_DAYS = 14;

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

export default function Workout() {
  const today = useSeoulToday();
  const [items, setItems] = useState<WorkoutItem[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const [its, lgs] = await Promise.all([
        listActiveItems(),
        listLogs(addDays(today, -(HISTORY_DAYS - 1)), today),
      ]);
      setItems(its);
      setLogs(lgs);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const isDone = (itemId: string, date: string) =>
    logs.some((l) => l.item_id === itemId && l.log_date === date && l.done);

  async function toggle(item: WorkoutItem) {
    const next = !isDone(item.id, today);
    // 화면 먼저 반영(낙관적 업데이트), 실패 시 되돌림
    const prev = logs;
    setLogs((ls) => [...ls.filter((l) => !(l.item_id === item.id && l.log_date === today)), { item_id: item.id, log_date: today, done: next }]);
    try {
      await setLog(item.id, today, next);
    } catch (e) {
      setLogs(prev);
      setError(errMsg(e));
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const it = await addItem(name, nextOrder);
      setItems((list) => [...list, it]);
      setNewName('');
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

  const doneToday = items.filter((i) => isDone(i.id, today)).length;
  const days = lastNDays(HISTORY_DAYS, today);
  const rateOf = (date: string) =>
    items.length === 0 ? 0 : items.filter((i) => isDone(i.id, date)).length / items.length;

  const avg = Math.round((days.reduce((s, d) => s + rateOf(d), 0) / days.length) * 100);
  // 연속 달성: 모든 항목을 끝낸 날이 오늘(또는 어제)부터 며칠 이어졌는지
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (rateOf(days[i]) === 1) streak++;
    else if (days[i] === today) continue;
    else break;
  }

  const routineList = (
    <ul className="list">
      {items.map((item, i) =>
        managing ? (
          <li key={item.id} className="list-item">
            <span className="item-main static"><span className="item-title">{item.name}</span></span>
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로"><Icon name="up" size={18} /></button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="아래로"><Icon name="down" size={18} /></button>
            <button className="icon-btn" onClick={() => remove(item)} aria-label="삭제"><Icon name="trash" size={18} /></button>
          </li>
        ) : (
          <li key={item.id} className={`list-item ${isDone(item.id, today) ? 'done' : ''}`}>
            <button className="check-row" onClick={() => toggle(item)}>
              <span className={`check ${isDone(item.id, today) ? 'on' : ''}`}>{isDone(item.id, today) ? '✓' : ''}</span>
              <span className="item-title">{item.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );

  return (
    <div>
      <PageHeader
        eyebrow={formatKoreanDate(today)}
        title="운동"
        subtitle="매일 자정(서울 기준)에 새 체크리스트가 시작됩니다"
        right={
          <button className={`btn ${managing ? 'primary' : ''}`} onClick={() => setManaging((v) => !v)}>
            {managing ? '편집 완료' : '루틴 편집'}
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

      <div className="grid-2">
        <Panel flush title={managing ? '루틴 편집' : '오늘의 루틴'} subtitle={managing ? '순서를 바꾸거나 항목을 뺄 수 있습니다' : '눌러서 체크'}>
          {managing && (
            <form className="add-form row" onSubmit={onAdd} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <input placeholder="예: 스쿼트 30개, 달리기 30분" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} />
              <button className="btn primary" disabled={!newName.trim()}><Icon name="plus" size={18} /> 추가</button>
            </form>
          )}
          {!loading && items.length === 0 ? (
            <EmptyState>
              루틴 항목이 없습니다.
              {!managing && <button className="btn primary" onClick={() => setManaging(true)}>루틴 만들기</button>}
            </EmptyState>
          ) : (
            routineList
          )}
        </Panel>

        <Panel title="최근 14일" subtitle="날짜별 루틴 달성률 (현재 항목 기준)">
          <div className="history-bars" aria-label="최근 14일 달성률">
            {days.map((d) => {
              const r = rateOf(d);
              return (
                <div key={d} className={`bar-col ${d === today ? 'is-today' : ''}`} title={`${formatKoreanDate(d)} ${Math.round(r * 100)}%`}>
                  <div className="bar-track">
                    <div className={`bar-fill ${r === 1 ? 'full' : ''}`} style={{ height: `${r * 100}%` }} />
                  </div>
                  <span className="bar-label">{weekdayKo(d)}</span>
                </div>
              );
            })}
          </div>
          <p className="panel-note">진한 막대 = 모든 항목 완료</p>
        </Panel>
      </div>
    </div>
  );
}
