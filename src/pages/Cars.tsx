import { useEffect, useState, type FormEvent } from 'react';
import {
  addCar,
  addItem,
  deleteCar,
  deleteItem,
  deleteLog,
  listCars,
  listItems,
  listLogs,
  recordDone,
  updateCar,
  updateItem,
  type Car,
  type CarItem,
  type CarLog,
} from '../api/cars';
import { CAR_CATEGORIES } from '../data/carTemplate';
import { addDays, todaySeoul } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

const FUELS = ['휘발유', '하이브리드', '경유', 'LPG', '전기'];
type Status = 'overdue' | 'soon' | 'unknown' | 'ok';
const STATUS_LABEL: Record<Status, string> = { overdue: '지남', soon: '곧', unknown: '기록 없음', ok: '양호' };
const ORDER: Record<Status, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };

const int = (v: string) => {
  const n = parseInt(v.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const km = (n: number) => `${n.toLocaleString()}km`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
function addMonthsTo(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/** 주기와 마지막 기록으로 상태 계산: km와 날짜 중 먼저 오는 쪽 */
function statusOf(item: CarItem, car: Car, today: string): { status: Status; text: string } {
  if (!item.last_done_date) return { status: 'unknown', text: '마지막으로 한 날을 입력하세요' };
  const parts: string[] = [];
  let status: Status = 'ok';
  const bump = (s: Status) => {
    if (ORDER[s] < ORDER[status]) status = s;
  };
  if (item.interval_km && item.last_done_km != null && car.odometer_km != null) {
    const left = item.last_done_km + item.interval_km - car.odometer_km;
    parts.push(left <= 0 ? `${km(-left)} 지남` : `${km(left)} 남음`);
    bump(left <= 0 ? 'overdue' : left <= Math.min(1000, item.interval_km * 0.1) ? 'soon' : 'ok');
  }
  if (item.interval_months) {
    const due = addMonthsTo(item.last_done_date, item.interval_months);
    const left = daysBetween(today, due);
    parts.push(left < 0 ? `${-left}일 지남` : left === 0 ? '오늘까지' : `${left}일 남음 (${due.slice(5).replace('-', '/')})`);
    bump(left < 0 ? 'overdue' : left <= Math.min(30, item.interval_months * 7) ? 'soon' : 'ok');
  }
  if (parts.length === 0) parts.push('주행거리를 입력하면 남은 거리가 보입니다');
  return { status, text: parts.join(' · ') };
}

const cycleText = (i: CarItem) =>
  [i.interval_km && km(i.interval_km), i.interval_months && (i.interval_months % 12 === 0 ? `${i.interval_months / 12}년` : `${i.interval_months}개월`)]
    .filter(Boolean)
    .join(' 또는 ') || '주기 없음';

export default function Cars() {
  const today = todaySeoul();
  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState<string | null>(null);
  const [items, setItems] = useState<CarItem[]>([]);
  const [logs, setLogs] = useState<CarLog[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [odo, setOdo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCars()
      .then((c) => {
        setCars(c);
        setCarId(c[0]?.id ?? null);
        if (c.length === 0) setAdding(true);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!carId) return;
    setItems([]);
    setLogs([]);
    setOpenId(null);
    Promise.all([listItems(carId), listLogs(carId)])
      .then(([i, l]) => {
        setItems(i);
        setLogs(l);
      })
      .catch((e) => setError(errMsg(e)));
  }, [carId]);

  const car = cars.find((c) => c.id === carId) ?? null;
  const run = (p: Promise<unknown>) => p.catch((e) => setError(errMsg(e)));

  async function onSaveOdo(e: FormEvent) {
    e.preventDefault();
    const n = int(odo);
    if (!car || n == null) return;
    run(
      updateCar(car.id, { odometer_km: n, odometer_date: today }).then((c) => {
        setCars((l) => l.map((x) => (x.id === c.id ? c : x)));
        setOdo('');
      }),
    );
  }

  async function onDeleteCar() {
    if (!car || !confirm(`${car.name}와 점검 기록을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    run(
      deleteCar(car.id).then(() => {
        const rest = cars.filter((c) => c.id !== car.id);
        setCars(rest);
        setCarId(rest[0]?.id ?? null);
        setEditing(false);
        if (rest.length === 0) setAdding(true);
      }),
    );
  }

  const withStatus = car
    ? items.map((i) => ({ item: i, ...statusOf(i, car, today) }))
    : [];
  const attention = withStatus.filter((x) => x.status === 'overdue' || x.status === 'soon').sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const unknown = withStatus.filter((x) => x.status === 'unknown').length;
  const categories = [...CAR_CATEGORIES, ...new Set(items.map((i) => i.category))].filter((c, n, a) => a.indexOf(c) === n && items.some((i) => i.category === c));

  return (
    <div>
      <PageHeader eyebrow="Car Care" title="차량 관리" subtitle="소모품 교체 주기를 주행거리·날짜로 챙깁니다. 항목을 누르면 '했어요'를 기록할 수 있습니다" />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {cars.length > 0 && (
        <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {cars.length > 1 && (
            <div className="segmented">
              {cars.map((c) => (
                <button key={c.id} className={c.id === carId ? 'active' : ''} onClick={() => setCarId(c.id)}>{c.name}</button>
              ))}
            </div>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={() => setAdding((v) => !v)}><Icon name="plus" size={16} /> 차 추가</button>
        </div>
      )}

      {adding && (
        <AddCarForm
          first={cars.length === 0}
          onCancel={cars.length ? () => setAdding(false) : undefined}
          onAdd={(input) =>
            run(
              addCar({ ...input, odometer_date: input.odometer_km != null ? today : null }, cars.length).then((c) => {
                setCars((l) => [...l, c]);
                setCarId(c.id);
                setAdding(false);
              }),
            )
          }
        />
      )}

      {loading ? (
        <Panel><div className="muted">불러오는 중…</div></Panel>
      ) : !car ? null : (
        <div className="day-layout">
          <div className="day-side">
            <Panel
              title={car.name}
              subtitle={`${car.fuel}${car.odometer_km != null ? ` · ${km(car.odometer_km)}` : ''}${car.odometer_date ? ` (${car.odometer_date.slice(5).replace('-', '/')} 기준)` : ''}`}
              right={<button className="btn ghost" onClick={() => setEditing((v) => !v)}>{editing ? '완료' : '편집'}</button>}
            >
              <form className="row" onSubmit={onSaveOdo}>
                <input inputMode="numeric" placeholder="현재 주행거리 km" value={odo} onChange={(e) => setOdo(e.target.value)} />
                <button className="btn primary" disabled={int(odo) == null}>저장</button>
              </form>
              <p className="panel-note">주유할 때 계기판 숫자를 가끔 적어 두면 남은 거리가 정확해집니다.</p>
              {editing && (
                <button className="btn ghost danger" style={{ marginTop: 12 }} onClick={onDeleteCar}>
                  <Icon name="trash" size={16} /> 이 차 삭제
                </button>
              )}
            </Panel>

            <Panel flush title="챙길 것" subtitle={attention.length ? undefined : unknown ? `기록 없는 항목 ${unknown}개` : '지금은 모두 양호합니다'}>
              {attention.length > 0 && (
                <ul className="list">
                  {attention.map(({ item, status, text }) => (
                    <li key={item.id} className="list-item">
                      <button className="item-main" onClick={() => setOpenId(item.id)}>
                        <span className="item-title">{item.name}</span>
                        <span className="meal-sub">{text}</span>
                      </button>
                      <span className={`status-badge ${status}`}>{STATUS_LABEL[status]}</span>
                    </li>
                  ))}
                </ul>
              )}
              {unknown > 0 && (
                <p className="panel-note" style={{ padding: '0 20px 14px' }}>
                  처음에는 항목마다 마지막으로 교체·점검한 날(모르면 대략)을 넣어 주세요.
                </p>
              )}
            </Panel>

            <Panel flush title="정비 이력">
              {logs.length === 0 ? (
                <p className="panel-note" style={{ padding: '0 20px 14px' }}>아직 없습니다</p>
              ) : (
                <ul className="list">
                  {logs.slice(0, 12).map((l) => (
                    <li key={l.id} className="list-item">
                      <span className="item-main static">
                        <span className="item-title">{l.item_name}</span>
                        <span className="meal-sub">
                          {[l.done_date, l.km != null && km(l.km), l.cost != null && `${l.cost.toLocaleString()}원`, l.memo].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <button
                        className="icon-btn"
                        aria-label="삭제"
                        onClick={() => confirm('이 이력을 삭제할까요?') && run(deleteLog(l.id).then(() => setLogs((x) => x.filter((y) => y.id !== l.id))))}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div>
            {categories.map((cat) => (
              <Panel key={cat} flush title={cat}>
                <ul className="list">
                  {withStatus
                    .filter((x) => x.item.category === cat)
                    .map(({ item, status, text }) =>
                      openId === item.id ? (
                        <ItemEditor
                          key={item.id}
                          item={item}
                          car={car}
                          today={today}
                          onClose={() => setOpenId(null)}
                          onDone={(done) =>
                            run(
                              recordDone(item, done).then(async ({ log, item: upd }) => {
                                setLogs((l) => [log, ...l].sort((a, b) => b.done_date.localeCompare(a.done_date)));
                                setItems((l) => l.map((x) => (x.id === upd.id ? upd : x)));
                                if (done.km != null && (car.odometer_km == null || done.km > car.odometer_km)) {
                                  const c = await updateCar(car.id, { odometer_km: done.km, odometer_date: done.done_date });
                                  setCars((l) => l.map((x) => (x.id === c.id ? c : x)));
                                }
                                setOpenId(null);
                              }),
                            )
                          }
                          onSaveCycle={(patch) =>
                            run(updateItem(item.id, patch).then((upd) => setItems((l) => l.map((x) => (x.id === upd.id ? upd : x)))))
                          }
                          onDelete={() =>
                            confirm(`'${item.name}' 항목을 삭제할까요? 지난 이력은 남습니다.`) &&
                            run(deleteItem(item.id).then(() => setItems((l) => l.filter((x) => x.id !== item.id))))
                          }
                        />
                      ) : (
                        <li key={item.id} className="list-item">
                          <button className="item-main" onClick={() => setOpenId(item.id)}>
                            <span className="item-title">{item.name}</span>
                            <span className="meal-sub">{cycleText(item)} · {text}</span>
                          </button>
                          <span className={`status-badge ${status}`}>{STATUS_LABEL[status]}</span>
                        </li>
                      ),
                    )}
                </ul>
              </Panel>
            ))}
            {editing && (
              <AddItemForm
                onAdd={(input) =>
                  run(addItem({ ...input, car_id: car.id }, items.length).then((i) => setItems((l) => [...l, i])))
                }
              />
            )}
            {items.length === 0 && (
              <Panel><EmptyState>점검 항목이 없습니다. 편집에서 추가하세요.</EmptyState></Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddCarForm({
  first,
  onAdd,
  onCancel,
}: {
  first: boolean;
  onAdd: (c: { name: string; fuel: string; odometer_km: number | null }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(first ? '그랜저' : '');
  const [fuel, setFuel] = useState('휘발유');
  const [odo, setOdo] = useState('');
  return (
    <Panel title={first ? '첫 차 등록' : '차 추가'} subtitle="기본 점검 항목(휘발유 승용차 기준 19개)이 함께 만들어집니다. 필요 없는 항목은 지우면 됩니다">
      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onAdd({ name: name.trim(), fuel, odometer_km: int(odo) });
        }}
      >
        <input placeholder="차 이름 (예: 그랜저)" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        <div className="segmented">
          {FUELS.map((f) => (
            <button type="button" key={f} className={fuel === f ? 'active' : ''} onClick={() => setFuel(f)}>{f}</button>
          ))}
        </div>
        <div className="row">
          <input inputMode="numeric" placeholder="현재 주행거리 km (선택)" value={odo} onChange={(e) => setOdo(e.target.value)} />
          {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>취소</button>}
          <button className="btn primary" disabled={!name.trim()}>등록</button>
        </div>
      </form>
    </Panel>
  );
}

function ItemEditor({
  item,
  car,
  today,
  onClose,
  onDone,
  onSaveCycle,
  onDelete,
}: {
  item: CarItem;
  car: Car;
  today: string;
  onClose: () => void;
  onDone: (d: { done_date: string; km: number | null; cost: number | null; memo: string | null }) => void;
  onSaveCycle: (p: { interval_km: number | null; interval_months: number | null }) => void;
  onDelete: () => void;
}) {
  const [date, setDate] = useState(today);
  const [kmv, setKm] = useState(car.odometer_km?.toString() ?? '');
  const [cost, setCost] = useState('');
  const [memo, setMemo] = useState('');
  const [ik, setIk] = useState(item.interval_km?.toString() ?? '');
  const [im, setIm] = useState(item.interval_months?.toString() ?? '');

  return (
    <li className="list-item editing">
      <div className="edit-form">
        <div className="row">
          <strong style={{ flex: 1 }}>{item.name}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기"><Icon name="close" size={18} /></button>
        </div>
        {item.note && <p className="panel-note" style={{ margin: 0 }}>{item.note}</p>}
        {item.last_done_date && (
          <p className="panel-note" style={{ margin: 0 }}>
            마지막: {item.last_done_date}{item.last_done_km != null ? ` · ${km(item.last_done_km)}` : ''}
          </p>
        )}
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            onDone({ done_date: date, km: int(kmv), cost: int(cost), memo: memo.trim() || null });
          }}
        >
          <div className="row">
            <input type="date" value={date} max={today} min={addDays(today, -365 * 15)} onChange={(e) => setDate(e.target.value || today)} />
            <input inputMode="numeric" placeholder="그때 주행거리 km" value={kmv} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div className="row">
            <input inputMode="numeric" placeholder="비용 원 (선택)" value={cost} onChange={(e) => setCost(e.target.value)} />
            <input placeholder="메모 (정비소·부품 등)" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} />
          </div>
          <button className="btn primary">했어요 · 기록</button>
        </form>
        <form
          className="row cycle-row"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveCycle({ interval_km: int(ik), interval_months: int(im) });
          }}
        >
          <span className="muted small">주기</span>
          <input className="kcal-input" inputMode="numeric" placeholder="km" value={ik} onChange={(e) => setIk(e.target.value)} />
          <input className="kcal-input" inputMode="numeric" placeholder="개월" value={im} onChange={(e) => setIm(e.target.value)} />
          <button className="btn ghost">주기 저장</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="icon-btn" onClick={onDelete} aria-label="항목 삭제"><Icon name="trash" size={18} /></button>
        </form>
      </div>
    </li>
  );
}

function AddItemForm({ onAdd }: { onAdd: (i: { category: string; name: string; interval_km: number | null; interval_months: number | null; note: string | null }) => void }) {
  const [category, setCategory] = useState(CAR_CATEGORIES[1]);
  const [name, setName] = useState('');
  const [ik, setIk] = useState('');
  const [im, setIm] = useState('');
  return (
    <Panel title="점검 항목 추가">
      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onAdd({ category, name: name.trim(), interval_km: int(ik), interval_months: int(im), note: null });
          setName('');
          setIk('');
          setIm('');
        }}
      >
        <div className="row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CAR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="항목 이름" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="row">
          <input className="kcal-input" inputMode="numeric" placeholder="주기 km" value={ik} onChange={(e) => setIk(e.target.value)} />
          <input className="kcal-input" inputMode="numeric" placeholder="주기 개월" value={im} onChange={(e) => setIm(e.target.value)} />
          <span style={{ flex: 1 }} />
          <button className="btn primary" disabled={!name.trim()}><Icon name="plus" size={18} /> 추가</button>
        </div>
      </form>
    </Panel>
  );
}
