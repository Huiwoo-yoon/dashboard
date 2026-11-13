import { useState } from 'react';
import { deleteImport, saveEpisode, type EpisodeDraft, type HealthImport, type MedDraft, type SymptomDraft } from '../api/imports';
import type { Episode } from '../api/episodes';
import { Icon } from './Icon';
import { errMsg } from './ui';

/** AI가 정리한 증상·약 기록을 고친 뒤 저장 */
export function EpisodeReview({
  imp,
  episodes,
  onDone,
  onError,
}: {
  imp: HealthImport;
  episodes: Episode[];
  onDone: (episodeId?: string) => void;
  onError: (m: string) => void;
}) {
  const [d, setD] = useState<EpisodeDraft>(() => {
    const x = structuredClone(imp.draft as EpisodeDraft);
    if (x.episode.existing_id && !episodes.some((e) => e.id === x.episode.existing_id)) x.episode.existing_id = '';
    return x;
  });
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const ep = d.episode;
  const setEp = (patch: Partial<EpisodeDraft['episode']>) => setD((x) => ({ ...x, episode: { ...x.episode, ...patch } }));
  const setSym = (i: number, p: Partial<SymptomDraft>) => setD((x) => ({ ...x, symptoms: x.symptoms.map((s, n) => (n === i ? { ...s, ...p } : s)) }));
  const setMed = (i: number, p: Partial<MedDraft>) => setD((x) => ({ ...x, medications: x.medications.map((s, n) => (n === i ? { ...s, ...p } : s)) }));
  const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const valid =
    (ep.existing_id || (ep.title.trim() && okDate(ep.start_date))) &&
    d.symptoms.every((s) => okDate(s.logged_at.slice(0, 10))) &&
    d.medications.every((m) => m.medication_name.trim() && okDate(m.start_date));

  async function save() {
    setSaving(true);
    try {
      const id = await saveEpisode(imp, d);
      onDone(id);
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="review">
      <div className="review-head">
        <strong>검토 · 증상 {d.symptoms.length} · 약 {d.medications.length}</strong>
        <button className="link-btn" onClick={() => setShowRaw((v) => !v)}>{showRaw ? '원문 닫기' : '원문 보기'}</button>
      </div>
      {showRaw && <pre className="raw-text">{imp.raw_text}</pre>}

      <label className="field-label">
        어떤 일로
        <select value={ep.existing_id} onChange={(e) => setEp({ existing_id: e.target.value })}>
          <option value="">새로 기록: {ep.title || '(제목)'}</option>
          {episodes.map((e) => (
            <option key={e.id} value={e.id}>기존 기록에 추가: {e.title} ({e.start_date}~)</option>
          ))}
        </select>
      </label>
      {!ep.existing_id ? (
        <div className="review-meta">
          <label>제목<input value={ep.title} onChange={(e) => setEp({ title: e.target.value })} /></label>
          <label>시작<input type="date" value={okDate(ep.start_date) ? ep.start_date : ''} onChange={(e) => setEp({ start_date: e.target.value })} /></label>
          <label>나은 날<input type="date" value={okDate(ep.end_date) ? ep.end_date : ''} onChange={(e) => setEp({ end_date: e.target.value })} /></label>
        </div>
      ) : (
        <div className="review-meta">
          <label>다 나았다면<input type="date" value={okDate(ep.end_date) ? ep.end_date : ''} onChange={(e) => setEp({ end_date: e.target.value })} /></label>
        </div>
      )}

      <h3 className="sub-title">증상</h3>
      <ul className="lab-edit">
        {d.symptoms.map((s, i) => (
          <li key={i}>
            <div className="sym-edit-grid">
              <input type="datetime-local" aria-label="시점" value={s.logged_at.length === 10 ? `${s.logged_at}T09:00` : s.logged_at.slice(0, 16)} onChange={(e) => setSym(i, { logged_at: e.target.value })} />
              <label className="sev">
                강도 <input type="number" min={1} max={10} value={s.severity} onChange={(e) => setSym(i, { severity: Number(e.target.value) })} />/10
              </label>
              <button className="icon-btn" aria-label="삭제" onClick={() => setD({ ...d, symptoms: d.symptoms.filter((_, n) => n !== i) })}><Icon name="trash" size={16} /></button>
              <input className="wide" aria-label="증상" placeholder="증상 (쉼표로 구분)" value={s.symptoms.join(', ')} onChange={(e) => setSym(i, { symptoms: e.target.value.split(',').map((t) => t.trimStart()) })} />
              <input className="wide" aria-label="메모" placeholder="메모" value={s.notes} onChange={(e) => setSym(i, { notes: e.target.value })} />
            </div>
          </li>
        ))}
      </ul>
      <button className="btn ghost small" onClick={() => setD({ ...d, symptoms: [...d.symptoms, { logged_at: new Date().toISOString().slice(0, 10), symptoms: [], severity: 3, notes: '' }] })}>
        <Icon name="plus" size={16} /> 증상 추가
      </button>

      <h3 className="sub-title">약</h3>
      <ul className="lab-edit">
        {d.medications.map((m, i) => (
          <li key={i}>
            <div className="sym-edit-grid">
              <input className="wide" aria-label="약 이름" placeholder="약 이름" value={m.medication_name} onChange={(e) => setMed(i, { medication_name: e.target.value })} />
              <input className="wide" aria-label="용법" placeholder="용량·용법" value={m.dosage} onChange={(e) => setMed(i, { dosage: e.target.value })} />
              <label>시작 <input type="date" value={okDate(m.start_date) ? m.start_date : ''} onChange={(e) => setMed(i, { start_date: e.target.value })} /></label>
              <label>끝 <input type="date" value={okDate(m.end_date) ? m.end_date : ''} onChange={(e) => setMed(i, { end_date: e.target.value })} /></label>
              <button className="icon-btn" aria-label="삭제" onClick={() => setD({ ...d, medications: d.medications.filter((_, n) => n !== i) })}><Icon name="trash" size={16} /></button>
              <label className="sev">
                효과
                <select value={m.effectiveness} onChange={(e) => setMed(i, { effectiveness: Number(e.target.value) })}>
                  <option value={0}>모름</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn ghost small" onClick={() => setD({ ...d, medications: [...d.medications, { medication_name: '', dosage: '', start_date: ep.start_date, end_date: '', effectiveness: 0, symptom_effect: '' }] })}>
        <Icon name="plus" size={16} /> 약 추가
      </button>

      <div className="row review-actions">
        <button className="btn ghost" onClick={() => confirm('정리한 내용을 버릴까요? 원문도 지워집니다.') && deleteImport(imp.id).then(() => onDone())}>버리기</button>
        <span style={{ flex: 1 }} />
        <button className="btn primary" disabled={saving || !valid} onClick={save}>{saving ? '저장 중…' : '확인하고 저장'}</button>
      </div>
    </div>
  );
}
