import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addTodo, deleteTodo, listTodos, setTodoDone, updateTodo, type Todo as TodoT } from '../api/todos';
import { todaySeoul, formatKoreanDate } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
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

export default function Todo() {
  const [todos, setTodos] = useState<TodoT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    listTodos()
      .then(setTodos)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => sortTodos(todos), [todos]);
  const open = sorted.filter((t) => !t.done);
  const done = sorted.filter((t) => t.done);

  const replace = (t: TodoT) => setTodos((list) => list.map((x) => (x.id === t.id ? t : x)));

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    try {
      const t = await addTodo(text, due || null);
      setTodos((list) => [...list, t]);
      setTitle('');
      setDue('');
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

  const rowProps = (t: TodoT) => ({
    todo: t,
    editing: editingId === t.id,
    onToggle: () => onToggle(t),
    onDelete: () => onDelete(t),
    onEdit: () => setEditingId(t.id),
    onCancel: () => setEditingId(null),
    onSave: (nt: string, nd: string) => onSave(t, nt, nd),
  });

  const today = todaySeoul();
  const dueToday = open.filter((t) => t.due_date === today).length;
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;

  return (
    <div>
      <PageHeader eyebrow={formatKoreanDate(today)} title="할 일" subtitle="마감이 가까운 일부터 위에 보입니다" />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="stats">
        <StatTile icon="check" label="남은 일" value={loading ? '–' : open.length} foot="미완료 항목" />
        <StatTile icon="calendar" label="오늘 마감" value={loading ? '–' : dueToday} foot={dueToday ? <span className="down">오늘까지</span> : '없음'} />
        <StatTile icon="calendar" label="기한 지남" value={loading ? '–' : overdue} foot={overdue ? <span className="down">확인 필요</span> : '없음'} />
        <StatTile icon="check" label="완료" value={loading ? '–' : done.length} foot="누적 완료" />
      </div>

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

      <Panel flush title="목록" subtitle="항목을 누르면 수정할 수 있습니다">
        {!loading && open.length === 0 && <EmptyState>남은 할 일이 없습니다.</EmptyState>}
        <ul className="list">
          {open.map((t) => (
            <TodoRow key={t.id} {...rowProps(t)} />
          ))}
        </ul>

        {done.length > 0 && (
          <>
            <button className="collapse-btn" onClick={() => setShowDone((v) => !v)}>
              <Icon name={showDone ? 'up' : 'down'} size={16} /> 완료됨 {done.length}
            </button>
            {showDone && (
              <ul className="list">
                {done.map((t) => (
                  <TodoRow key={t.id} {...rowProps(t)} />
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
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
