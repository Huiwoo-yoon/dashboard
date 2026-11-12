import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addTodo, deleteTodo, listTodos, setTodoDone, updateTodo, type Todo as TodoT } from '../api/todos';
import { todaySeoul, formatKoreanDate, monthStart } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { Calendar, type DayMark } from '../components/Calendar';
import { Icon } from '../components/Icon';

/** 미완료 먼저 → 마감일 빠른 순(없으면 뒤) → 생성 순 */
function sortTodos(list: TodoT[]): TodoT[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (b.done_at ?? '').localeCompare(a.done_at ?? '');
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

/** 완료 시각 → 서울 기준 날짜 */
const doneDate = (t: TodoT) => (t.done_at ? todaySeoul(new Date(t.done_at)) : null);

export default function Todo() {
  const today = todaySeoul();
  const [todos, setTodos] = useState<TodoT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthStart(today));

  useEffect(() => {
    listTodos()
      .then(setTodos)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  function selectDate(d: string) {
    setSelected(d);
    setMonth(monthStart(d));
    setDue(d === today ? '' : d); // 다른 날짜를 고르면 새 할 일의 마감일로 미리 채움
  }

  const sorted = useMemo(() => sortTodos(todos), [todos]);
  const open = sorted.filter((t) => !t.done);
  const done = sorted.filter((t) => t.done);

  // 달력 표시: 마감 있는 날 점, 미완료인데 기한 지난 날 빨간 점, 완료한 날 연한 칠
  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const t of todos) {
      if (t.due_date) {
        const mk = (m[t.due_date] ??= {});
        mk.dot = true;
        if (!t.done && t.due_date < today) mk.alert = true;
      }
      const dd = doneDate(t);
      if (dd) (m[dd] ??= {}).level = Math.min(1, ((m[dd].level ?? 0) + 0.34));
    }
    for (const k in m) if ((m[k].level ?? 0) >= 1) m[k].level = 0.99; // 완료는 연하게만
    return m;
  }, [todos, today]);

  const dueOnDay = sorted.filter((t) => t.due_date === selected);
  const doneOnDay = sorted.filter((t) => doneDate(t) === selected && t.due_date !== selected);

  const replace = (t: TodoT) => setTodos((list) => list.map((x) => (x.id === t.id ? t : x)));

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    try {
      const t = await addTodo(text, due || null);
      setTodos((list) => [...list, t]);
      setTitle('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onToggle(t: TodoT) {
    try {
      replace(await setTodoDone(t.id, !t.done));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onDelete(t: TodoT) {
    if (!confirm(`"${t.title}" 삭제할까요?`)) return;
    try {
      await deleteTodo(t.id);
      setTodos((list) => list.filter((x) => x.id !== t.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onSave(t: TodoT, newTitle: string, newDue: string) {
    try {
      replace(await updateTodo(t.id, { title: newTitle.trim() || t.title, due_date: newDue || null }));
      setEditingId(null);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const row = (t: TodoT, prefix = '') => (
    <TodoRow
      key={prefix + t.id}
      todo={t}
      editing={editingId === prefix + t.id}
      onToggle={() => onToggle(t)}
      onDelete={() => onDelete(t)}
      onEdit={() => setEditingId(prefix + t.id)}
      onCancel={() => setEditingId(null)}
      onSave={(nt, nd) => onSave(t, nt, nd)}
    />
  );

  const dueTodayCount = open.filter((t) => t.due_date === today).length;
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;

  return (
    <div>
      <PageHeader eyebrow={formatKoreanDate(today)} title="할 일" subtitle="달력에서 날짜를 누르면 그날 마감·완료한 일이 보입니다" />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="stats">
        <StatTile icon="check" label="남은 일" value={loading ? '–' : open.length} foot="미완료 항목" />
        <StatTile icon="calendar" label="오늘 마감" value={loading ? '–' : dueTodayCount} foot={dueTodayCount ? <span className="down">오늘까지</span> : '없음'} />
        <StatTile icon="calendar" label="기한 지남" value={loading ? '–' : overdue} foot={overdue ? <span className="down">확인 필요</span> : '없음'} />
        <StatTile icon="check" label="완료" value={loading ? '–' : done.length} foot="누적 완료" />
      </div>

      <div className="day-layout">
        <div className="day-side">
          <Panel>
            <Calendar month={month} selected={selected} marks={marks} onSelect={selectDate} onMonthChange={setMonth} />
            <p className="panel-note">점 = 마감일 · 빨간 점 = 기한 지남 · 칠한 날 = 완료한 날</p>
          </Panel>
          <Panel title="새 할 일">
            <form className="add-form" onSubmit={onAdd}>
              <input placeholder="무엇을 해야 하나요?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
              <div className="row">
                <label className="inline-label">
                  마감일
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </label>
                <button className="btn primary" disabled={!title.trim()}>
                  <Icon name="plus" size={18} /> 추가
                </button>
              </div>
            </form>
          </Panel>
        </div>

        <div>
          <Panel flush title={selected === today ? `오늘 · ${formatKoreanDate(selected)}` : formatKoreanDate(selected)} subtitle={`마감 ${dueOnDay.length} · 이날 완료 ${doneOnDay.length + dueOnDay.filter((t) => doneDate(t) === selected).length}`}>
            {dueOnDay.length === 0 && doneOnDay.length === 0 ? (
              <EmptyState>이날 마감이거나 완료한 일이 없습니다.</EmptyState>
            ) : (
              <ul className="list">
                {dueOnDay.map((t) => row(t, 'd-'))}
                {doneOnDay.map((t) => row(t, 'd-'))}
              </ul>
            )}
          </Panel>

          <Panel flush title="전체 목록" subtitle="항목을 누르면 수정할 수 있습니다">
            {!loading && open.length === 0 && <EmptyState>남은 할 일이 없습니다.</EmptyState>}
            <ul className="list">{open.map((t) => row(t))}</ul>
            {done.length > 0 && (
              <>
                <button className="collapse-btn" onClick={() => setShowDone((v) => !v)}>
                  <Icon name={showDone ? 'up' : 'down'} size={16} /> 완료됨 {done.length}
                </button>
                {showDone && <ul className="list">{done.map((t) => row(t))}</ul>}
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  todo: TodoT;
  editing: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (title: string, due: string) => void;
}

function TodoRow({ todo, editing, onToggle, onDelete, onEdit, onCancel, onSave }: RowProps) {
  const [title, setTitle] = useState(todo.title);
  const [due, setDue] = useState(todo.due_date ?? '');

  useEffect(() => {
    if (editing) {
      setTitle(todo.title);
      setDue(todo.due_date ?? '');
    }
  }, [editing, todo]);

  if (editing) {
    return (
      <li className="list-item editing">
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(title, due);
          }}
        >
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
          <div className="row">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <span style={{ flex: 1 }} />
            <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
            <button className="btn primary">저장</button>
          </div>
        </form>
      </li>
    );
  }

  const today = todaySeoul();
  const overdue = !todo.done && todo.due_date && todo.due_date < today;
  const dueToday = !todo.done && todo.due_date === today;

  return (
    <li className={`list-item ${todo.done ? 'done' : ''}`}>
      <button className={`check ${todo.done ? 'on' : ''}`} onClick={onToggle} aria-label={todo.done ? '완료 취소' : '완료'}>
        {todo.done ? '✓' : ''}
      </button>
      <button className="item-main" onClick={onEdit} aria-label="수정">
        <span className="item-title">{todo.title}</span>
        {todo.due_date && (
          <span className={`due ${overdue ? 'overdue' : ''} ${dueToday ? 'today' : ''}`}>
            {dueToday ? '오늘까지' : formatKoreanDate(todo.due_date)}
            {overdue && ' · 지남'}
          </span>
        )}
      </button>
      <button className="icon-btn" onClick={onDelete} aria-label="삭제"><Icon name="trash" size={18} /></button>
    </li>
  );
}
