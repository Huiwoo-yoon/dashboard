import { useEffect, useState, type FormEvent } from 'react';
import { addMeal, deleteMeal, listMeals, updateMeal, MEAL_TYPES, type Meal, type MealType } from '../api/meals';
import { addDays, formatKoreanDate, todaySeoul } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

function parseKcal(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function Meals() {
  const [date, setDate] = useState(todaySeoul());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 추가 폼
  const [type, setType] = useState<MealType>('breakfast');
  const [desc, setDesc] = useState('');
  const [kcal, setKcal] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMeals(date)
      .then((m) => !cancelled && setMeals(m))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const total = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const isToday = date === todaySeoul();

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    try {
      const m = await addMeal({ meal_date: date, meal_type: type, description: desc.trim(), kcal: parseKcal(kcal) });
      setMeals((list) => [...list, m]);
      setDesc('');
      setKcal('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onSave(m: Meal, patch: Pick<Meal, 'meal_type' | 'description' | 'kcal'>) {
    try {
      const updated = await updateMeal(m.id, patch);
      setMeals((list) => list.map((x) => (x.id === m.id ? updated : x)));
      setEditingId(null);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onDelete(m: Meal) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    try {
      await deleteMeal(m.id);
      setMeals((list) => list.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const mealsCovered = MEAL_TYPES.filter((t) => t.value !== 'snack' && meals.some((m) => m.meal_type === t.value)).length;

  const dateBox = (
    <div className="date-box">
      <button className="icon-btn" onClick={() => setDate((d) => addDays(d, -1))} aria-label="전날"><Icon name="left" size={18} /></button>
      <label className="date-pick">
        <small>{isToday ? 'TODAY' : 'DATE'}</small>
        <strong>{formatKoreanDate(date)}</strong>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="날짜 선택" />
      </label>
      <button className="icon-btn" onClick={() => setDate((d) => addDays(d, 1))} aria-label="다음날"><Icon name="right" size={18} /></button>
      {!isToday && <button className="btn small" onClick={() => setDate(todaySeoul())}>오늘</button>}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Meal Log" title="식단" subtitle="끼니별로 먹은 것과 칼로리를 기록합니다" right={dateBox} />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="stats three">
        <StatTile icon="activity" label="하루 합계" value={<>{loading ? '–' : total.toLocaleString()}<small>kcal</small></>} foot="입력한 칼로리 합" />
        <StatTile icon="meal" label="끼니" value={<>{mealsCovered}<small>/ 3</small></>} foot="아침·점심·저녁" />
        <StatTile icon="grid" label="기록" value={<>{meals.length}<small>건</small></>} foot="간식 포함" />
      </div>

      <div className="grid-2">
        <Panel title="기록 추가">
          <form className="add-form" onSubmit={onAdd}>
            <div className="segmented">
              {MEAL_TYPES.map((t) => (
                <button type="button" key={t.value} className={type === t.value ? 'active' : ''} onClick={() => setType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
            <input placeholder="무엇을 먹었나요?" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
            <div className="row">
              <input
                className="kcal-input"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="kcal (선택)"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
              />
              <span style={{ flex: 1 }} />
              <button className="btn primary" disabled={!desc.trim()}><Icon name="plus" size={18} /> 추가</button>
            </div>
          </form>
        </Panel>

        <Panel flush title={isToday ? "오늘 먹은 것" : "먹은 것"} subtitle="항목을 누르면 수정할 수 있습니다">
          {!loading && meals.length === 0 && <EmptyState>이 날짜에 기록된 식단이 없습니다.</EmptyState>}
          {MEAL_TYPES.map((t) => {
            const group = meals.filter((m) => m.meal_type === t.value);
            if (group.length === 0) return null;
            const sub = group.reduce((s, m) => s + (m.kcal ?? 0), 0);
            return (
              <section key={t.value}>
                <h3 className="group-title">
                  {t.label}
                  {sub > 0 && <span>{sub.toLocaleString()} kcal</span>}
                </h3>
                <ul className="list">
                  {group.map((m) =>
                    editingId === m.id ? (
                      <MealEditRow key={m.id} meal={m} onCancel={() => setEditingId(null)} onSave={(p) => onSave(m, p)} />
                    ) : (
                      <li key={m.id} className="list-item">
                        <button className="item-main" onClick={() => setEditingId(m.id)} aria-label="수정">
                          <span className="item-title">{m.description}</span>
                        </button>
                        {m.kcal != null && <span className="kcal-cell">{m.kcal.toLocaleString()} kcal</span>}
                        <button className="icon-btn" onClick={() => onDelete(m)} aria-label="삭제"><Icon name="trash" size={18} /></button>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}

function MealEditRow({
  meal,
  onCancel,
  onSave,
}: {
  meal: Meal;
  onCancel: () => void;
  onSave: (p: Pick<Meal, 'meal_type' | 'description' | 'kcal'>) => void;
}) {
  const [type, setType] = useState<MealType>(meal.meal_type);
  const [desc, setDesc] = useState(meal.description);
  const [kcal, setKcal] = useState(meal.kcal?.toString() ?? '');

  return (
    <li className="list-item editing">
      <form
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ meal_type: type, description: desc.trim() || meal.description, kcal: parseKcal(kcal) });
        }}
      >
        <select value={type} onChange={(e) => setType(e.target.value as MealType)}>
          {MEAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
        <div className="row">
          <input className="kcal-input" type="number" inputMode="numeric" min={0} placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
          <button className="btn primary">저장</button>
        </div>
      </form>
    </li>
  );
}
