import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addNote,
  deleteNote,
  getInsight,
  getMyMemberId,
  listLabs,
  listMembers,
  listNotes,
  listRecords,
  requestInsight,
  setMyMemberId,
  type CheckupInsight,
  type HealthNote,
  type HealthRecord,
  type LabResult,
  type Member,
} from '../api/checkup';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

/** 검진 기관·연도마다 이름이 달라서 같은 검사끼리 묶는다 */
const KEY_TESTS: { label: string; names: string[] }[] = [
  { label: '체중', names: ['체중', '몸무게'] },
  { label: 'BMI', names: ['BMI', '체질량지수(BMI)'] },
  { label: '허리둘레', names: ['허리둘레'] },
  { label: '수축기 혈압', names: ['수축기 혈압', '혈압 (수축기)'] },
  { label: '이완기 혈압', names: ['이완기 혈압', '혈압 (이완기)'] },
  { label: '공복혈당', names: ['공복혈당', 'Glucose(AC)'] },
  { label: '당화혈색소', names: ['HbA1c-NGSP', 'HbA1c'] },
  { label: '총콜레스테롤', names: ['총콜레스테롤', 'T.Cholesterol'] },
  { label: 'LDL', names: ['LDL 콜레스테롤', 'LDL-Cholesterol (Friedewald계산법)', 'LDL-Cholesterol'] },
  { label: 'HDL', names: ['HDL 콜레스테롤', 'HDL-Cholesterol'] },
  { label: '중성지방', names: ['중성지방', 'Triglyceride'] },
  { label: 'AST', names: ['AST', 'AST (SGOT)', 'AST(GOT)'] },
  { label: 'ALT', names: ['ALT', 'ALT (SGPT)', 'ALT(GPT)'] },
  { label: '감마GTP', names: ['r-GTP', 'γ-GTP', '감마지티피'] },
  { label: '크레아티닌', names: ['혈청 크레아티닌', 'Cr'] },
  { label: 'eGFR', names: ['신사구체여과율', 'e-GFR'] },
  { label: '혈색소', names: ['혈색소', 'Hemoglobin(혈색소)'] },
  { label: '요산', names: ['Uric acid'] },
];

const NOTE_CATEGORIES = ['복용약', '알레르기', '질환·병력', '가족력', '목표', '기타'];
const STATUS = { good: '양호', watch: '주의', concern: '관심 필요' } as const;

const day = (d: string) => d.slice(0, 10);
const shortDate = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
const fmtVal = (l: LabResult) => (l.value != null ? String(l.value) : l.raw_value ?? '');
const ageOf = (birth: string | null) => {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};
const stamp = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export default function Checkup() {
  const [members, setMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [notes, setNotes] = useState<HealthNote[]>([]);
  const [insight, setInsight] = useState<CheckupInsight | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteCat, setNoteCat] = useState(NOTE_CATEGORIES[0]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, r, saved, n, ins] = await Promise.all([listMembers(), listRecords(), getMyMemberId(), listNotes(), getInsight()]);
      setMembers(m);
      setRecords(r);
      setNotes(n);
      setInsight(ins);
      // 저장한 사람이 없으면 기록이 가장 많은 사람 (맥미니 분석도 같은 기준)
      const busiest = [...m].sort((a, b) => r.filter((x) => x.member_id === b.id).length - r.filter((x) => x.member_id === a.id).length)[0];
      setMemberId(saved && m.some((x) => x.id === saved) ? saved : busiest?.id ?? null);
    })()
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  const mine = useMemo(() => records.filter((r) => r.member_id === memberId), [records, memberId]);

  useEffect(() => {
    const ids = mine.filter((r) => r.type === '검진결과').map((r) => r.id);
    listLabs(ids)
      .then(setLabs)
      .catch((e) => setError(errMsg(e)));
  }, [mine]);

  const labsBy = useMemo(() => {
    const m: Record<string, LabResult[]> = {};
    for (const l of labs) (m[l.record_id] ??= []).push(l);
    return m;
  }, [labs]);
  // 수치가 있는 검진만, 최근 순
  const checkups = mine.filter((r) => labsBy[r.id]?.length).sort((a, b) => b.date.localeCompare(a.date));
  const cols = checkups.slice(0, 6);
  const rows = KEY_TESTS.map((t) => ({
    ...t,
    cells: cols.map((c) => labsBy[c.id].find((l) => t.names.includes(l.test_name.trim())) ?? null),
  })).filter((r) => r.cells.some(Boolean));
  const detail = checkups.find((c) => c.id === detailId) ?? checkups[0];

  // 일상 기록 (같은 날 중복 저장된 것은 하나로)
  const daily = Object.values(
    Object.fromEntries(mine.filter((r) => r.type !== '검진결과' && (r.weight || r.sys || r.fasting)).map((r) => [day(r.date), r])),
  ).sort((a, b) => b.date.localeCompare(a.date));

  const member = members.find((m) => m.id === memberId);
  const age = ageOf(member?.birth_date ?? null);
  const pending = !!insight?.requested_at && (!insight.created_at || insight.requested_at > insight.created_at);
  const ins = insight?.member_id === memberId ? insight?.insight : null;

  async function onMember(id: string) {
    setMemberId(id);
    setDetailId(null);
    try {
      await setMyMemberId(id);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function onRequest() {
    try {
      const requested_at = await requestInsight();
      setInsight((cur) => ({ member_id: cur?.member_id ?? null, insight: cur?.insight ?? null, created_at: cur?.created_at ?? null, requested_at }));
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      const n = await addNote(noteCat, noteText.trim());
      setNotes((l) => [...l, n]);
      setNoteText('');
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function onDeleteNote(n: HealthNote) {
    if (!confirm('이 메모를 삭제할까요?')) return;
    try {
      await deleteNote(n.id);
      setNotes((l) => l.filter((x) => x.id !== n.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Health Record"
        title="건강 기록"
        subtitle="Health log 앱의 검진 기록을 모아 보고, 내 건강 메모와 함께 AI 인사이트를 받습니다"
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {loading ? (
        <Panel><div className="muted">불러오는 중…</div></Panel>
      ) : members.length === 0 ? (
        <Panel>
          <EmptyState>
            Health log 앱에서 읽어 온 기록이 없습니다.
            <span className="small">같은 계정으로 Health log 앱의 가족에 연결되어 있어야 보입니다.</span>
          </EmptyState>
        </Panel>
      ) : (
        <div className="day-layout">
          <div className="day-side">
            <Panel
              title={member?.name ?? '나'}
              subtitle={[member?.gender === 'male' ? '남성' : member?.gender === 'female' ? '여성' : null, age != null ? `만 ${age}세` : null, `검진 ${checkups.length}회`].filter(Boolean).join(' · ')}
            >
              {members.length > 1 && (
                <label className="field-label">
                  누구의 기록을 볼까요
                  <select value={memberId ?? ''} onChange={(e) => onMember(e.target.value)}>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name ?? '이름 없음'}</option>
                    ))}
                  </select>
                </label>
              )}
            </Panel>

            <Panel title="내 건강 메모" subtitle="AI 인사이트와 주간 리포트에 참고됩니다">
              <form className="add-form" onSubmit={onAddNote}>
                <select value={noteCat} onChange={(e) => setNoteCat(e.target.value)}>
                  {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="row">
                  <input placeholder="예: 비타민D 1000IU 매일 / 체지방 줄이기" value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={1000} />
                  <button className="btn primary" disabled={!noteText.trim()} aria-label="메모 추가"><Icon name="plus" size={18} /></button>
                </div>
              </form>
              {notes.length > 0 && (
                <ul className="list weight-list">
                  {notes.map((n) => (
                    <li key={n.id} className="list-item">
                      <span className="item-main static">
                        <span className="note-cat">{n.category}</span>
                        <span>{n.content}</span>
                      </span>
                      <button className="icon-btn" onClick={() => onDeleteNote(n)} aria-label="삭제"><Icon name="trash" size={18} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {daily.length > 0 && (
              <Panel flush title="일상 기록" subtitle="Health log 앱">
                <ul className="list">
                  {daily.slice(0, 6).map((r) => (
                    <li key={r.id} className="list-item">
                      <span className="item-main static">{shortDate(r.date)}</span>
                      <span className="kcal-cell">
                        {[r.weight && `${r.weight}kg`, r.sys && `${r.sys}/${r.dia}`, r.fasting && `혈당 ${r.fasting}`].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div>
            <Panel
              title="AI 인사이트"
              subtitle={insight?.created_at ? `${stamp(insight.created_at)} 분석 · 참고용이며 진단이 아닙니다` : '참고용이며 진단이 아닙니다'}
              right={
                <button className="btn ghost" onClick={onRequest} disabled={pending}>
                  {pending ? '분석 요청됨' : '다시 분석'}
                </button>
              }
            >
              {pending && <p className="panel-note" style={{ marginTop: 0, marginBottom: 12 }}>맥미니가 10분 안에 분석합니다. 잠시 후 새로고침하세요.</p>}
              {!ins ? (
                <p className="muted small" style={{ margin: 0 }}>
                  아직 인사이트가 없습니다. 새 검진이 들어오거나 메모가 바뀌면 맥미니가 자동으로 분석합니다.
                </p>
              ) : (
                <>
                  <p className="news-summary">{ins.headline}</p>
                  <ul className="insight-items">
                    {ins.items.map((it) => (
                      <li key={it.topic}>
                        <span className={`status-badge ${it.status}`}>{STATUS[it.status] ?? it.status}</span>
                        <span>
                          <strong>{it.topic}</strong> {it.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {ins.lifestyle && <p className="insight" style={{ marginTop: 14 }}>{ins.lifestyle}</p>}
                  <h3 className="sub-title">생활에서 해볼 것</h3>
                  <ul className="bullets">{ins.recommendations.map((t) => <li key={t}>{t}</li>)}</ul>
                  {ins.ask_doctor.length > 0 && (
                    <>
                      <h3 className="sub-title">다음 진료·검진 때 물어볼 것</h3>
                      <ul className="bullets">{ins.ask_doctor.map((t) => <li key={t}>{t}</li>)}</ul>
                    </>
                  )}
                </>
              )}
            </Panel>

            {cols.length > 0 && (
              <Panel flush title="주요 수치 추세" subtitle="최근 검진 순 · 굵은 빨간 숫자 = 검진 기관이 표시한 이상 소견">
                <div className="table-scroll">
                  <table className="lab-table">
                    <thead>
                      <tr>
                        <th>검사</th>
                        {cols.map((c) => <th key={c.id}>{shortDate(c.date)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.label}>
                          <th>
                            {r.label}
                            <small>{r.cells.find((c) => c?.unit)?.unit ?? ''}</small>
                          </th>
                          {r.cells.map((c, i) => (
                            <td key={i} className={c?.is_abnormal ? 'abn' : ''}>{c ? fmtVal(c) : '–'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {detail && (
              <Panel
                flush
                title="검진 전체 항목"
                right={
                  <select value={detail.id} onChange={(e) => setDetailId(e.target.value)} aria-label="검진 날짜">
                    {checkups.map((c) => <option key={c.id} value={c.id}>{day(c.date)}</option>)}
                  </select>
                }
              >
                <div className="table-scroll">
                  <table className="lab-table full">
                    <tbody>
                      {labsBy[detail.id].map((l, i) => (
                        <tr key={i}>
                          <th>
                            {l.test_name}
                            <small>{l.category}</small>
                          </th>
                          <td className={l.is_abnormal ? 'abn' : ''}>{fmtVal(l)} {l.unit ?? ''}</td>
                          <td className="muted small">{l.reference_range ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
