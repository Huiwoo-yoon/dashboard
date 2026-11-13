import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addMed,
  addSymptom,
  deleteEpisode,
  deleteMed,
  deleteSymptom,
  listEpisodes,
  listMeds,
  listSymptoms,
  updateEpisode,
  updateMed,
  type Episode,
  type MedLog,
  type SymptomLog,
} from '../api/episodes';
import { useViewedMember } from '../lib/member';
import { todaySeoul } from '../lib/date';
import { MemberSwitch } from '../components/MemberSwitch';
import { ImportInbox } from '../components/ImportInbox';
import { EpisodeReview } from '../components/EpisodeReview';
import { EpisodeChart } from '../components/EpisodeChart';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

const seoulDT = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const period = (a: string, b: string | null) => `${a.slice(2).replace(/-/g, '.')} ~ ${b ? b.slice(2).replace(/-/g, '.') : '진행 중'}`;
const nowLocal = () => {
  const d = new Date(Date.now() + 9 * 3600000);
  return d.toISOString().slice(0, 16);
};

export default function Illness() {
  const today = todaySeoul();
  const { members, memberId, setMemberId, member, loading: mLoading, error: mError } = useViewedMember();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomLog[]>([]);
  const [meds, setMeds] = useState<MedLog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mError) setError(errMsg(mError));
  }, [mError]);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const eps = await listEpisodes(memberId);
      const ids = eps.map((e) => e.id);
      const [s, m] = await Promise.all([listSymptoms(ids), listMeds(ids)]);
      if (cancelled) return;
      setEpisodes(eps);
      setSymptoms(s);
      setMeds(m);
      setSelected((cur) => (cur && eps.some((e) => e.id === cur) ? cur : (eps.find((e) => e.status === 'active') ?? eps[0])?.id ?? null));
    })()
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [memberId, reload]);

  const sorted = [...episodes].sort((a, b) => (a.status === b.status ? b.start_date.localeCompare(a.start_date) : a.status === 'active' ? -1 : 1));
  const ep = episodes.find((e) => e.id === selected) ?? null;
  const epSym = symptoms.filter((s) => s.episode_id === selected);
  const epMed = meds.filter((m) => m.episode_id === selected);

  // 최근 1년 한눈에
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const recent = episodes.filter((e) => (e.end_date ?? today) >= yearAgo);
  const overview = useMemo(() => {
    const ids = new Set(recent.map((e) => e.id));
    const count = (arr: string[]) =>
      Object.entries(arr.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    return {
      symptoms: count(symptoms.filter((s) => ids.has(s.episode_id)).flatMap((s) => s.symptoms)),
      meds: count(meds.filter((m) => ids.has(m.episode_id)).map((m) => m.medication_name)),
    };
  }, [recent, symptoms, meds]);

  const run = (p: Promise<unknown>) => p.catch((e) => setError(errMsg(e)));

  return (
    <div>
      <PageHeader eyebrow="Illness Log" title="아플 때" subtitle="증상과 먹은 약을 날짜별로 남겨 추이를 봅니다. Health log 앱과 같은 기록을 씁니다" />
      <MemberSwitch members={members} value={memberId} onChange={setMemberId} />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {mLoading || !memberId ? (
        <Panel><div className="muted">불러오는 중…</div></Panel>
      ) : (
        <div className="day-layout">
          <div className="day-side">
            <Panel title="기록하기" subtitle={`${member?.name ?? ''} · 생각나는 대로 적으면 AI가 날짜·증상·약으로 나눕니다`}>
              <ImportInbox
                memberId={memberId}
                kind="episode"
                placeholder={'예: 어제 저녁부터 목이 따갑고 오늘 아침 열 38.2. 타이레놀 500mg 2정 먹고 오후엔 37.4. 이비인후과에서 3일치 처방 받음'}
                hint="맥미니 AI가 정리하면 확인 후 저장합니다."
                onError={setError}
                renderReview={(imp, done) => (
                  <EpisodeReview
                    imp={imp}
                    episodes={episodes}
                    onError={setError}
                    onDone={(id) => {
                      done();
                      if (id) setSelected(id);
                      setReload((n) => n + 1);
                    }}
                  />
                )}
              />
            </Panel>

            <Panel flush title="기록 목록">
              {loading ? (
                <p className="panel-note" style={{ padding: '0 20px 14px' }}>불러오는 중…</p>
              ) : sorted.length === 0 ? (
                <p className="panel-note" style={{ padding: '0 20px 14px' }}>아직 없습니다</p>
              ) : (
                sorted.map((e) => (
                  <button key={e.id} className={`week-item episode-item${e.id === selected ? ' active' : ''}`} onClick={() => setSelected(e.id)}>
                    <span>{e.title}</span>
                    <span className="muted small">{period(e.start_date, e.end_date)}</span>
                    {e.status === 'active' && <span className="status-badge watch">진행 중</span>}
                  </button>
                ))
              )}
            </Panel>

            {recent.length > 0 && (
              <Panel title="최근 1년" subtitle={`아팠던 기록 ${recent.length}건`}>
                {overview.symptoms.length > 0 && (
                  <>
                    <h3 className="sub-title" style={{ marginTop: 0 }}>자주 있었던 증상</h3>
                    <div className="chips">{overview.symptoms.map(([k, n]) => <span key={k} className="chip">{k} <b>{n}</b></span>)}</div>
                  </>
                )}
                {overview.meds.length > 0 && (
                  <>
                    <h3 className="sub-title">자주 먹은 약</h3>
                    <div className="chips">{overview.meds.map(([k, n]) => <span key={k} className="chip">{k} <b>{n}</b></span>)}</div>
                  </>
                )}
              </Panel>
            )}
          </div>

          <div>
            {!ep ? (
              <Panel><EmptyState>아직 아팠던 기록이 없습니다. 왼쪽에 생각나는 대로 적어 보세요.</EmptyState></Panel>
            ) : (
              <>
                <Panel
                  title={ep.title}
                  subtitle={`${period(ep.start_date, ep.end_date)}${ep.description ? ` · ${ep.description}` : ''}`}
                  right={
                    ep.status === 'active' ? (
                      <button className="btn ghost small" onClick={() => run(updateEpisode(ep.id, { end_date: today, status: 'resolved' }).then(() => setReload((n) => n + 1)))}>
                        나았어요
                      </button>
                    ) : (
                      <button className="btn ghost small" onClick={() => run(updateEpisode(ep.id, { end_date: null, status: 'active' }).then(() => setReload((n) => n + 1)))}>
                        다시 진행 중
                      </button>
                    )
                  }
                >
                  {epSym.length + epMed.length === 0 ? (
                    <p className="muted small" style={{ margin: 0 }}>증상이나 약을 기록하면 추이 그래프가 나타납니다.</p>
                  ) : (
                    <EpisodeChart episode={ep} symptoms={epSym} meds={epMed} today={today} />
                  )}
                  <p className="panel-note">선 = 증상 강도(1~10), 막대 = 약 복용 기간 (점선 = 복용 중)</p>
                </Panel>

                <Panel flush title="증상 기록">
                  <ul className="list">
                    {[...epSym].reverse().map((s) => (
                      <li key={s.id} className="list-item">
                        <span className="item-main static">
                          <span className="item-title">{s.symptoms.join(', ') || '증상'} <span className="sev-pill">{s.severity}/10</span></span>
                          <span className="meal-sub">{seoulDT(s.logged_at)}{s.notes ? ` · ${s.notes}` : ''}</span>
                        </span>
                        <button className="icon-btn" aria-label="삭제" onClick={() => confirm('이 증상 기록을 삭제할까요?') && run(deleteSymptom(s.id).then(() => setSymptoms((l) => l.filter((x) => x.id !== s.id))))}>
                          <Icon name="trash" size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <SymptomForm onAdd={(v) => run(addSymptom({ ...v, episode_id: ep.id }).then((s) => setSymptoms((l) => [...l, s].sort((a, b) => a.logged_at.localeCompare(b.logged_at)))))} />
                </Panel>

                <Panel flush title="약">
                  <ul className="list">
                    {epMed.map((m) => (
                      <li key={m.id} className="list-item">
                        <span className="item-main static">
                          <span className="item-title">{m.medication_name}</span>
                          <span className="meal-sub">
                            {[m.dosage, period(m.start_date, m.end_date).replace('진행 중', '복용 중'), m.effectiveness && `효과 ${m.effectiveness}/5`, m.symptom_effect].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {!m.end_date && (
                          <button className="btn ghost small" onClick={() => run(updateMed(m.id, { end_date: today }).then(() => setMeds((l) => l.map((x) => (x.id === m.id ? { ...x, end_date: today } : x)))))}>
                            그만 먹음
                          </button>
                        )}
                        <button className="icon-btn" aria-label="삭제" onClick={() => confirm('이 약 기록을 삭제할까요?') && run(deleteMed(m.id).then(() => setMeds((l) => l.filter((x) => x.id !== m.id))))}>
                          <Icon name="trash" size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <MedForm today={today} onAdd={(v) => run(addMed({ ...v, episode_id: ep.id }).then((m) => setMeds((l) => [...l, m])))} />
                </Panel>

                <button
                  className="btn ghost danger"
                  onClick={() => confirm(`'${ep.title}' 기록과 증상·약을 모두 삭제할까요? Health log 앱에서도 지워지며 되돌릴 수 없습니다.`) && run(deleteEpisode(ep.id).then(() => setReload((n) => n + 1)))}
                >
                  <Icon name="trash" size={16} /> 이 기록 삭제
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SymptomForm({ onAdd }: { onAdd: (v: Omit<SymptomLog, 'id' | 'episode_id'>) => void }) {
  const [at, setAt] = useState(nowLocal);
  const [tags, setTags] = useState('');
  const [sev, setSev] = useState(4);
  const [note, setNote] = useState('');
  return (
    <form
      className="add-form inline-add"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!tags.trim()) return;
        onAdd({ logged_at: `${at}:00+09:00`, symptoms: tags.split(',').map((t) => t.trim()).filter(Boolean), severity: sev, notes: note.trim() || null });
        setTags('');
        setNote('');
        setAt(nowLocal());
      }}
    >
      <div className="row">
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        <input placeholder="증상 (쉼표로 구분)" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="row">
        <label className="sev-range">
          강도 <b>{sev}</b>
          <input type="range" min={1} max={10} value={sev} onChange={(e) => setSev(Number(e.target.value))} />
        </label>
        <input placeholder="메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" disabled={!tags.trim()} aria-label="증상 추가"><Icon name="plus" size={18} /></button>
      </div>
    </form>
  );
}

function MedForm({ today, onAdd }: { today: string; onAdd: (v: Omit<MedLog, 'id' | 'episode_id'>) => void }) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [start, setStart] = useState(today);
  return (
    <form
      className="add-form inline-add"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd({ medication_name: name.trim(), dosage: dosage.trim() || null, start_date: start, end_date: null, effectiveness: null, symptom_effect: null });
        setName('');
        setDosage('');
      }}
    >
      <div className="row">
        <input placeholder="약 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="용량·용법" value={dosage} onChange={(e) => setDosage(e.target.value)} />
      </div>
      <div className="row">
        <label className="muted small">시작</label>
        <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value || today)} />
        <span style={{ flex: 1 }} />
        <button className="btn primary" disabled={!name.trim()} aria-label="약 추가"><Icon name="plus" size={18} /></button>
      </div>
    </form>
  );
}
