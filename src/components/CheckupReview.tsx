import { useState } from 'react';
import { deleteImport, saveCheckup, type CheckupDraft, type HealthImport, type LabDraft } from '../api/imports';
import { Icon } from './Icon';
import { errMsg } from './ui';

/** AI가 정리한 검사 결과를 원문과 비교하며 고친 뒤 저장 */
export function CheckupReview({ imp, onDone, onError }: { imp: HealthImport; onDone: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState<CheckupDraft>(() => structuredClone(imp.draft as CheckupDraft));
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<LabDraft>) => setD((x) => ({ ...x, results: x.results.map((r, n) => (n === i ? { ...r, ...patch } : r)) }));
  const abnormal = d.results.filter((r) => r.is_abnormal).length;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date);

  async function save() {
    if (!validDate) return onError('검사 날짜를 YYYY-MM-DD로 넣어 주세요');
    setSaving(true);
    try {
      await saveCheckup(imp, d);
      onDone();
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="review">
      <div className="review-head">
        <strong>검토 · {d.results.length}개 항목{abnormal ? ` (이상 ${abnormal})` : ''}</strong>
        <button className="link-btn" onClick={() => setShowRaw((v) => !v)}>{showRaw ? '원문 닫기' : '원문 보기'}</button>
      </div>
      {showRaw && <pre className="raw-text">{imp.raw_text}</pre>}

      <div className="review-meta">
        <label>검사 날짜<input type="date" value={validDate ? d.date : ''} onChange={(e) => setD({ ...d, date: e.target.value })} /></label>
        <label>기관<input value={d.institution ?? ''} onChange={(e) => setD({ ...d, institution: e.target.value })} placeholder="(선택)" /></label>
      </div>
      <label className="field-label">
        소견·판독 (서술형)
        <textarea rows={3} value={d.findings ?? ''} onChange={(e) => setD({ ...d, findings: e.target.value })} placeholder="종합소견, 초음파·내시경 판독 등" />
      </label>

      <ul className="lab-edit">
        {d.results.map((r, i) => (
          <li key={i} className={r.is_abnormal ? 'abn' : ''}>
            <div className="lab-edit-grid">
              <input aria-label="검사명" className="name" value={r.test_name} onChange={(e) => setRow(i, { test_name: e.target.value })} />
              <input aria-label="결과" className="val" value={r.raw_value} onChange={(e) => setRow(i, { raw_value: e.target.value, value: null })} />
              <input aria-label="단위" className="unit" value={r.unit ?? ''} placeholder="단위" onChange={(e) => setRow(i, { unit: e.target.value })} />
              <input aria-label="분류" className="cat" value={r.category ?? ''} placeholder="분류" onChange={(e) => setRow(i, { category: e.target.value })} />
              <input aria-label="참고치" className="ref" value={r.reference_range ?? ''} placeholder="참고치" onChange={(e) => setRow(i, { reference_range: e.target.value })} />
              <label className="abn-check">
                <input type="checkbox" checked={r.is_abnormal} onChange={(e) => setRow(i, { is_abnormal: e.target.checked, auto_flag: false })} /> 이상
              </label>
              <button className="icon-btn" aria-label="항목 삭제" onClick={() => setD({ ...d, results: d.results.filter((_, n) => n !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            {r.source_line && (
              <p className="source-line">
                원문: {r.source_line}
                {r.auto_flag && <em> · 참고치를 벗어나 자동으로 이상 표시</em>}
              </p>
            )}
          </li>
        ))}
      </ul>
      <button className="btn ghost small" onClick={() => setD({ ...d, results: [...d.results, { test_name: '', raw_value: '', is_abnormal: false }] })}>
        <Icon name="plus" size={16} /> 항목 추가
      </button>

      <div className="row review-actions">
        <button className="btn ghost" onClick={() => confirm('정리한 내용을 버릴까요? 원문도 지워집니다.') && deleteImport(imp.id).then(onDone)}>버리기</button>
        <span style={{ flex: 1 }} />
        <span className="muted small">{imp.model}</span>
        <button className="btn primary" disabled={saving || !validDate} onClick={save}>{saving ? '저장 중…' : '확인하고 저장'}</button>
      </div>
    </div>
  );
}
