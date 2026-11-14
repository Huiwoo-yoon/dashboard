import { useEffect, useState } from 'react';
import { deleteRecord, getRecordDetail, saveLabs, updateRecord, type HealthRecord, type LabInput, type LabResult, type RecordDetail } from '../api/checkup';
import { Icon } from './Icon';
import { errMsg } from './ui';

type Row = LabInput & { id?: string };
const fmtVal = (l: LabResult) => (l.value != null ? String(l.value) : l.raw_value ?? '');

/** 저장된 검사 기록 하나: 보기 / 원문 / 고치기 / 삭제 */
export function RecordView({
  record,
  labs,
  onChanged,
  onError,
}: {
  record: HealthRecord;
  labs: LabResult[];
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState({ date: '', institution: '', findings: '' });
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [onlyAbn, setOnlyAbn] = useState(false);

  useEffect(() => {
    setDetail(null);
    setEditing(false);
    setShowRaw(false);
    getRecordDetail(record.id)
      .then(setDetail)
      .catch((e) => onError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  function startEdit() {
    setMeta({ date: record.date.slice(0, 10), institution: detail?.institution_name ?? '', findings: detail?.summary_notes ?? '' });
    setRows(labs.map(({ id, category, test_name, raw_value, unit, reference_range, is_abnormal }) => ({ id, category, test_name, raw_value: raw_value ?? fmtVal({ value: null, raw_value } as LabResult), unit, reference_range, is_abnormal: !!is_abnormal })));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await updateRecord(record.id, { date: meta.date, institution_name: meta.institution.trim() || null, summary_notes: meta.findings.trim() || null });
      await saveLabs(record.id, labs, rows);
      setEditing(false);
      onChanged();
      setDetail(await getRecordDetail(record.id));
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`${record.date.slice(0, 10)} 검사 기록과 항목 ${labs.length}개를 삭제할까요? Health log 앱에서도 지워지며 되돌릴 수 없습니다.`)) return;
    try {
      await deleteRecord(record.id);
      onChanged();
    } catch (e) {
      onError(errMsg(e));
    }
  }

  const setRow = (i: number, p: Partial<Row>) => setRows((l) => l.map((r, n) => (n === i ? { ...r, ...p } : r)));
  const abnCount = labs.filter((l) => l.is_abnormal).length;
  const shown = onlyAbn ? labs.filter((l) => l.is_abnormal) : labs;

  if (editing) {
    return (
      <div className="review" style={{ margin: '0 20px 16px' }}>
        <div className="review-meta">
          <label>검사 날짜<input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></label>
          <label>기관<input value={meta.institution} onChange={(e) => setMeta({ ...meta, institution: e.target.value })} /></label>
        </div>
        <label className="field-label">
          소견·판독
          <textarea rows={3} value={meta.findings} onChange={(e) => setMeta({ ...meta, findings: e.target.value })} />
        </label>
        <ul className="lab-edit">
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className={r.is_abnormal ? 'abn' : ''}>
              <div className="lab-edit-grid">
                <input aria-label="검사명" className="name" value={r.test_name} onChange={(e) => setRow(i, { test_name: e.target.value })} />
                <input aria-label="결과" className="val" value={r.raw_value ?? ''} onChange={(e) => setRow(i, { raw_value: e.target.value })} />
                <input aria-label="단위" className="unit" value={r.unit ?? ''} placeholder="단위" onChange={(e) => setRow(i, { unit: e.target.value })} />
                <input aria-label="분류" className="cat" value={r.category ?? ''} placeholder="분류" onChange={(e) => setRow(i, { category: e.target.value })} />
                <input aria-label="참고치" className="ref" value={r.reference_range ?? ''} placeholder="참고치" onChange={(e) => setRow(i, { reference_range: e.target.value })} />
                <label className="abn-check">
                  <input type="checkbox" checked={r.is_abnormal ?? false} onChange={(e) => setRow(i, { is_abnormal: e.target.checked })} /> 이상
                </label>
                <button className="icon-btn" aria-label="항목 삭제" onClick={() => setRows((l) => l.filter((_, n) => n !== i))}><Icon name="trash" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn ghost small" onClick={() => setRows((l) => [...l, { test_name: '', raw_value: '', unit: null, category: null, reference_range: null, is_abnormal: false }])}>
          <Icon name="plus" size={16} /> 항목 추가
        </button>
        <div className="row review-actions">
          <button className="btn ghost danger" onClick={remove}><Icon name="trash" size={16} /> 기록 삭제</button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={() => setEditing(false)}>취소</button>
          <button className="btn primary" disabled={saving || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="record-view">
      <div className="row record-actions">
        <span className="muted small" style={{ flex: 1 }}>
          {labs.length}개 항목{abnCount ? ` · 이상 ${abnCount}` : ''}
        </span>
        {abnCount > 0 && <button className="btn ghost small" onClick={() => setOnlyAbn((v) => !v)}>{onlyAbn ? '전체 보기' : '이상만'}</button>}
        {detail?.notes && <button className="btn ghost small" onClick={() => setShowRaw((v) => !v)}>{showRaw ? '원문 닫기' : '원문'}</button>}
        <button className="btn ghost small" onClick={startEdit}><Icon name="edit" size={16} /> 고치기</button>
      </div>
      {detail?.summary_notes && <p className="insight record-findings">{detail.summary_notes}</p>}
      {showRaw && detail?.notes && <pre className="raw-text" style={{ margin: '0 20px 12px' }}>{detail.notes}</pre>}
      {labs.length === 0 ? (
        <p className="panel-note" style={{ padding: '0 20px 14px' }}>검사 항목이 없습니다. '고치기'에서 추가할 수 있습니다.</p>
      ) : (
        <div className="table-scroll">
          <table className="lab-table full">
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
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
      )}
    </div>
  );
}
