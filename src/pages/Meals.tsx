import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addMeal, deleteMeal, getInsight, listMeals, mealKcal, updateMeal, MEAL_TYPES, type Meal, type MealType } from '../api/meals';
import { formatKoreanDate, monthEnd, monthStart, todaySeoul } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { Calendar, type DayMark } from '../components/Calendar';
import { Icon } from '../components/Icon';

function parseKcal(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface Totals { kcal: number; p: number; c: number; f: number; analyzed: number; count: number }

function totalsOf(list: Meal[]): Totals {
  return list.reduce<Totals>(
    (t, m) => ({
      kcal: t.kcal + (mealKcal(m) ?? 0),
      p: t.p + Number(m.protein_g ?? 0),
      c: t.c + Number(m.carbs_g ?? 0),
      f: t.f + Number(m.fat_g ?? 0),
      analyzed: t.analyzed + (m.analyzed_at ? 1 : 0),
      count: t.count + 1,
    }),
    { kcal: 0, p: 0, c: 0, f: 0, analyzed: 0, count: 0 },
  );
}

const g = (n: number) => `${Math.round(n)}`;
const kLabel = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export default function Meals() {
  const today = todaySeoul();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthStart(today));
  const [meals, setMeals] = useState<Meal[]>([]); // 보이는 달 전체
  const [insight, setInsight] = useState<string | null>(null);
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
    listMeals(monthStart(month), monthEnd(month))
      .then((m) => !cancelled && setMeals(m))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setInsight(null);
    getInsight(selected)
      .then((s) => !cancelled && setInsight(s))
      .catch(() => {}); // 인사이트 테이블이 아직 없어도 화면은 동작
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function selectDate(d: string) {
    setSelected(d);
    setMonth(monthStart(d));
    setEditingId(null);
  }

  const dayMeals = meals.filter((m) => m.meal_date === selected);
  const day = totalsOf(dayMeals);
  const macroKcal = day.p * 4 + day.c * 4 + day.f * 9;
  const pct = (x: number) => (macroKcal ? (x / macroKcal) * 100 : 0);

  // 달력: 날짜별 칼로리 합 (없으면 기록 점)
  const byDate = useMemo(() => {
    const m: Record<string, Meal[]> = {};
    for (const x of meals) (m[x.meal_date] ??= []).push(x);
    return m;
  }, [meals]);
  const marks: Record<string, DayMark> = {};
  for (const [d, list] of Object.entries(byDate)) {
    const k = totalsOf(list).kcal;
    marks[d] = k > 0 ? { label: kLabel(k) } : { dot: true };
  }

  // 이번 달 평균 (기록한 날 기준)
  const loggedDays = Object.keys(byDate).length;
  const monthTotals = totalsOf(meals);
  const avg = (n: number) => (loggedDays ? n / loggedDays : 0);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    try {
      const m = await addMeal({ meal_date: selected, meal_type: type, description: desc.trim(), kcal: parseKcal(kcal) });
      setMeals((list) => [...list, m]);
      setDesc('');
      setKcal('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onSave(m: Meal, patch: Pick<Meal, 'meal_type' | 'description' | 'kcal'>) {
    try {
      const updated = await updateMeal(m.id, patch, patch.description !== m.description);
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

  const isToday = selected === today;

  return (
    <div>
      <PageHeader
        eyebrow="Meal Log"
        title="식단"
        subtitle="먹은 것을 편하게 적으면, 맥미니가 매일 밤 칼로리와 영양소를 분석해 채웁니다"
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="stats">
        <StatTile icon="activity" label={isToday ? '오늘 칼로리' : '칼로리'} value={<>{loading ? '–' : day.kcal.toLocaleString()}<small>kcal</small></>} foot={formatKoreanDate(selected)} />
        <StatTile icon="meal" label="단백질" value={<>{g(day.p)}<small>g</small></>} foot={macroKcal ? `열량의 ${Math.round(pct(day.p * 4))}%` : '분석 전'} />
        <StatTile icon="meal" label="탄수화물" value={<>{g(day.c)}<small>g</small></>} foot={macroKcal ? `열량의 ${Math.round(pct(day.c * 4))}%` : '분석 전'} />
        <StatTile icon="meal" label="지방" value={<>{g(day.f)}<small>g</small></>} foot={macroKcal ? `열량의 ${Math.round(pct(day.f * 9))}%` : '분석 전'} />
      </div>

      <div className="day-layout">
        <div className="day-side">
          <Panel>
            <Calendar month={month} selected={selected} marks={marks} onSelect={selectDate} onMonthChange={setMonth} />
            <p className="panel-note">숫자 = 그날 칼로리 합계</p>
          </Panel>
          <Panel title={`${Number(month.slice(5, 7))}월 평균`} subtitle={`기록한 ${loggedDays}일 기준, 하루 평균`}>
            {loggedDays === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>이번 달 기록이 없습니다.</p>
            ) : (
              <div className="stats three" style={{ margin: 0 }}>
                <StatTile label="칼로리" value={<>{Math.round(avg(monthTotals.kcal)).toLocaleString()}<small>kcal</small></>} />
                <StatTile label="단백질" value={<>{g(avg(monthTotals.p))}<small>g</small></>} />
                <StatTile label="탄·지" value={<>{g(avg(monthTotals.c))}<small>/ {g(avg(monthTotals.f))}g</small></>} />
              </div>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="기록 추가" subtitle={`${formatKoreanDate(selected)}에 추가됩니다`}>
            <form className="add-form" onSubmit={onAdd}>
              <div className="segmented">
                {MEAL_TYPES.map((t) => (
                  <button type="button" key={t.value} className={type === t.value ? 'active' : ''} onClick={() => setType(t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <input placeholder="예: 고등어 백반, 김치찌개 반 공기" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
              <div className="row">
                <input className="kcal-input" type="number" inputMode="numeric" min={0} placeholder="kcal (선택)" value={kcal} onChange={(e) => setKcal(e.target.value)} />
                <span style={{ flex: 1 }} />
                <button className="btn primary" disabled={!desc.trim()}><Icon name="plus" size={18} /> 추가</button>
              </div>
            </form>
          </Panel>

          {(macroKcal > 0 || insight) && (
            <Panel title="하루 인사이트" subtitle="AI 분석 (참고용 추정치)">
              {macroKcal > 0 && (
                <>
                  <div className="macro-bar" aria-label="탄단지 비율">
                    <span className="m-p" style={{ width: `${pct(day.p * 4)}%` }} />
                    <span className="m-c" style={{ width: `${pct(day.c * 4)}%` }} />
                    <span className="m-f" style={{ width: `${pct(day.f * 9)}%` }} />
                  </div>
                  <div className="macro-legend">
                    <span><i className="m-p" />단백질 {Math.round(pct(day.p * 4))}%</span>
                    <span><i className="m-c" />탄수화물 {Math.round(pct(day.c * 4))}%</span>
                    <span><i className="m-f" />지방 {Math.round(pct(day.f * 9))}%</span>
                  </div>
                </>
              )}
              {insight && <p className="insight" style={{ marginTop: macroKcal ? 16 : 0 }}>{insight}</p>}
            </Panel>
          )}

          <Panel flush title={isToday ? '오늘 먹은 것' : `${formatKoreanDate(selected)} 먹은 것`} subtitle={day.count ? `분석 완료 ${day.analyzed}/${day.count} · 항목을 누르면 수정` : undefined}>
            {!loading && dayMeals.length === 0 && <EmptyState>이 날짜에 기록된 식단이 없습니다.</EmptyState>}
            {MEAL_TYPES.map((t) => {
              const group = dayMeals.filter((m) => m.meal_type === t.value);
              if (group.length === 0) return null;
              const sub = totalsOf(group).kcal;
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
                            {m.analyzed_at ? (
                              <span className="meal-sub">
                                {m.food_name && m.food_name !== m.description ? `${m.food_name} · ` : ''}
                                단 {g(Number(m.protein_g ?? 0))}g · 탄 {g(Number(m.carbs_g ?? 0))}g · 지 {g(Number(m.fat_g ?? 0))}g
                              </span>
                            ) : (
                              <span className="pending">분석 대기</span>
                            )}
                          </button>
                          {mealKcal(m) != null && (
                            <span className="kcal-cell">{mealKcal(m)!.toLocaleString()} kcal{m.kcal == null ? '*' : ''}</span>
                          )}
                          <button className="icon-btn" onClick={() => onDelete(m)} aria-label="삭제"><Icon name="trash" size={18} /></button>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              );
            })}
            {dayMeals.some((m) => m.kcal == null && m.ai_kcal != null) && <p className="panel-note" style={{ padding: '0 20px 14px' }}>* AI 추정 칼로리</p>}
          </Panel>
        </div>
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
          <input className="kcal-input" type="number" inputMode="numeric" min={0} placeholder="kcal (직접)" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
          <button className="btn primary">저장</button>
        </div>
      </form>
    </li>
  );
}
