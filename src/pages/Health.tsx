import { useEffect, useState, type FormEvent } from 'react';
import {
  deleteWeight,
  getHeight,
  getReport,
  listReportWeeks,
  listWeights,
  saveWeight,
  setHeight,
  type HealthReport,
  type Weight,
} from '../api/health';
import { addDays, formatKoreanDate, todaySeoul } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, StatTile, Panel, errMsg } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { Icon } from '../components/Icon';

/** "11월 9일 – 11월 15일" */
function weekRange(start: string): string {
  const fmt = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
  return `${fmt(start)} – ${fmt(addDays(start, 6))}`;
}

const bmiOf = (kg: number, cm: number) => kg / (cm / 100) ** 2;
/** 대한비만학회 기준 */
const bmiLabel = (b: number) => (b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '비만 전 단계' : '비만');
const parseNum = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function Health() {
  const today = todaySeoul();
  const [weights, setWeights] = useState<Weight[]>([]);
  const [height, setHeightState] = useState<number | null>(null);
  const [editingHeight, setEditingHeight] = useState(false);
  const [heightDraft, setHeightDraft] = useState('');
  const [wDate, setWDate] = useState(today);
  const [wKg, setWKg] = useState('');
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listWeights(), getHeight(), listReportWeeks()])
      .then(([w, h, wk]) => {
        setWeights(w);
        setHeightState(h);
        setWeeks(wk);
        setSelected(wk[0] ?? null);
        if (wk.length === 0) setLoading(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    getReport(selected)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function onSaveWeight(e: FormEvent) {
    e.preventDefault();
    const kg = parseNum(wKg);
    if (kg == null || kg < 20 || kg > 300) return setError('체중은 20~300kg 사이로 적어 주세요');
    try {
      const w = await saveWeight(wDate, Math.round(kg * 10) / 10);
      setWeights((list) => [...list.filter((x) => x.weigh_date !== w.weigh_date), w].sort((a, b) => a.weigh_date.localeCompare(b.weigh_date)));
      setWKg('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onSaveHeight(e: FormEvent) {
    e.preventDefault();
    const cm = parseNum(heightDraft);
    if (cm == null || cm < 50 || cm > 250) return setError('키는 50~250cm 사이로 적어 주세요');
    try {
      await setHeight(cm);
      setHeightState(cm);
      setEditingHeight(false);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onDeleteWeight(w: Weight) {
    if (!confirm(`${formatKoreanDate(w.weigh_date)} 체중 기록을 삭제할까요?`)) return;
    try {
      await deleteWeight(w.id);
      setWeights((list) => list.filter((x) => x.id !== w.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const latest = weights[weights.length - 1] ?? null;
  const bmi = latest && height ? bmiOf(latest.weight_kg, height) : null;
  const points: [number, number][] = weights.map((w) => [Date.parse(`${w.weigh_date}T12:00:00+09:00`) / 1000, w.weight_kg]);
  const s = report?.stats;
  const r = report?.report;

  return (
    <div>
      <PageHeader
        eyebrow={selected ? weekRange(selected) : 'Weekly Health'}
        title="주간 건강"
        subtitle="매주 월요일 아침, 지난 월~일 식단·운동·체중을 AI가 평가하고 조절할 부분을 알려 줍니다"
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {s && (
        <div className="stats">
          <StatTile icon="meal" label="하루 평균 열량" value={<>{s.avg_kcal.toLocaleString()}<small>kcal</small></>} foot={`식단 기록 ${s.meal_days}일 · ${s.meal_count}끼`} />
          <StatTile
            icon="meal"
            label="단백질"
            value={<>{s.avg_protein_g}<small>g/일</small></>}
            foot={s.macro_pct ? `단${s.macro_pct.p} · 탄${s.macro_pct.c} · 지${s.macro_pct.f}%` : '분석 전'}
          />
          <StatTile
            icon="activity"
            label="운동 체크"
            value={<>{s.workout_done}<small>/ {s.workout_possible}</small></>}
            foot={`운동한 날 ${s.workout_days}일`}
          />
          <StatTile
            icon="heart"
            label="체중"
            value={s.weight_latest != null ? <>{s.weight_latest}<small>kg</small></> : '–'}
            foot={s.bmi != null ? `BMI ${s.bmi}` : '기록 없음'}
          />
        </div>
      )}

      <div className="day-layout">
        <div className="day-side">
          <Panel
            title="체중 기록"
            subtitle={
              editingHeight ? undefined : (
                <>
                  키 {height ?? '–'}cm{' '}
                  <button
                    className="link-btn"
                    onClick={() => {
                      setHeightDraft(height?.toString() ?? '');
                      setEditingHeight(true);
                    }}
                  >
                    수정
                  </button>
                </>
              )
            }
          >
            {editingHeight && (
              <form className="row" style={{ marginBottom: 12 }} onSubmit={onSaveHeight}>
                <input className="kcal-input" type="number" inputMode="decimal" step="0.1" placeholder="키 cm" value={heightDraft} onChange={(e) => setHeightDraft(e.target.value)} autoFocus />
                <span style={{ flex: 1 }} />
                <button type="button" className="btn ghost" onClick={() => setEditingHeight(false)}>취소</button>
                <button className="btn primary">저장</button>
              </form>
            )}
            <form className="row" onSubmit={onSaveWeight}>
              <input type="date" value={wDate} max={today} onChange={(e) => setWDate(e.target.value || today)} />
              <input className="kcal-input" type="number" inputMode="decimal" step="0.1" placeholder="kg" value={wKg} onChange={(e) => setWKg(e.target.value)} />
              <button className="btn primary" disabled={!wKg} aria-label="체중 저장"><Icon name="plus" size={18} /></button>
            </form>
            {latest && (
              <p className="weight-now">
                <strong>{latest.weight_kg}kg</strong>
                {bmi != null && <> · BMI {bmi.toFixed(1)} ({bmiLabel(bmi)})</>}
                <span className="muted small"> · {formatKoreanDate(latest.weigh_date)}</span>
              </p>
            )}
            {points.length >= 2 && (
              <LineChart points={points} range="1mo" color="var(--ink)" format={(v) => `${v.toFixed(1)}kg`} label="체중 변화" />
            )}
            {weights.length > 0 ? (
              <ul className="list weight-list">
                {weights.slice(-5).reverse().map((w) => (
                  <li key={w.id} className="list-item">
                    <span className="item-main static">{formatKoreanDate(w.weigh_date)}</span>
                    <span className="kcal-cell">{w.weight_kg}kg</span>
                    <button className="icon-btn" onClick={() => onDeleteWeight(w)} aria-label="삭제"><Icon name="trash" size={18} /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-note">같은 날 다시 적으면 덮어씁니다. 아침 공복 같은 시간대에 재면 비교하기 좋습니다.</p>
            )}
          </Panel>

          <Panel flush title="지난 리포트">
            {weeks.length > 0 ? (
              weeks.map((w) => (
                <button key={w} className={`week-item${w === selected ? ' active' : ''}`} onClick={() => setSelected(w)}>
                  {weekRange(w)}
                </button>
              ))
            ) : (
              <p className="panel-note" style={{ padding: '0 20px 14px' }}>아직 없습니다</p>
            )}
          </Panel>
        </div>

        <div>
          {loading ? (
            <Panel><div className="muted">불러오는 중…</div></Panel>
          ) : !report || !r || !s ? (
            <Panel>
              <EmptyState>
                아직 주간 리포트가 없습니다.
                <span className="small">맥미니가 매주 월요일 07:15에 지난 월~일 기록으로 만듭니다.</span>
              </EmptyState>
            </Panel>
          ) : (
            <>
              <Panel title="한 주 총평" subtitle="AI 평가 (칼로리·영양소는 추정치)">
                <p className="news-summary">{r.headline}</p>
              </Panel>

              <Panel title="식단 구성">
                {s.macro_pct && (
                  <>
                    <div className="macro-bar" aria-label="탄단지 비율">
                      <span className="m-p" style={{ width: `${s.macro_pct.p}%` }} />
                      <span className="m-c" style={{ width: `${s.macro_pct.c}%` }} />
                      <span className="m-f" style={{ width: `${s.macro_pct.f}%` }} />
                    </div>
                    <div className="macro-legend" style={{ marginBottom: 14 }}>
                      <span><i className="m-p" />단백질 {s.macro_pct.p}% · {s.avg_protein_g}g</span>
                      <span><i className="m-c" />탄수화물 {s.macro_pct.c}% · {s.avg_carbs_g}g</span>
                      <span><i className="m-f" />지방 {s.macro_pct.f}% · {s.avg_fat_g}g</span>
                    </div>
                  </>
                )}
                <p className="insight">{r.diet}</p>
              </Panel>

              <Panel title="운동">
                <p className="insight">{r.exercise}</p>
                {s.workout_items.length > 0 && (
                  <ul className="workout-counts">
                    {s.workout_items.map((i) => (
                      <li key={i.name}>
                        <span>{i.name}</span>
                        <span className="dots" aria-label={`7일 중 ${i.done}회`}>
                          {Array.from({ length: 7 }, (_, k) => <i key={k} className={k < i.done ? 'on' : ''} />)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="체중·BMI">
                <p className="insight">{r.body}</p>
              </Panel>

              <Panel title="잘한 점"><Bullets items={r.good} /></Panel>
              <Panel title="조절하면 좋을 부분"><Bullets items={r.adjust} /></Panel>
              <Panel title="다음 주 목표"><Bullets items={r.next_week} /></Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="bullets">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}
