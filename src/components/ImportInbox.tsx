import { useEffect, useState, type ReactNode } from 'react';
import { createImport, deleteImport, listOpenImports, listSavedImports, retryImport, savedTo, type HealthImport, type ImportKind } from '../api/imports';
import { errMsg } from './ui';

const STATUS: Record<string, string> = { pending: '맥미니 대기 중', parsing: 'AI가 정리하는 중', ready: '검토 대기', failed: '정리 실패' };
const when = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/**
 * 원문 붙여넣기 → 맥미니(15초마다 확인)가 AI로 정리 → 검토 화면(renderReview).
 * 정리 중인 것이 있으면 4초마다 상태를 다시 읽는다.
 */
export function ImportInbox({
  memberId,
  kind,
  placeholder,
  hint,
  renderReview,
  onError,
  onOpenSaved,
  refreshKey,
}: {
  memberId: string;
  kind: ImportKind;
  placeholder: string;
  hint: ReactNode;
  renderReview: (imp: HealthImport, done: () => void) => ReactNode;
  onError: (msg: string) => void;
  /** 저장된 입력의 '보기' → 그 기록으로 이동 */
  onOpenSaved?: (savedToId: string) => void;
  /** 바뀌면 저장된 목록을 다시 읽는다 */
  refreshKey?: number;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<HealthImport[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<HealthImport[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [rawId, setRawId] = useState<string | null>(null);

  const load = () =>
    Promise.all([listOpenImports(memberId, kind), listSavedImports(memberId, kind)])
      .then(([open, done]) => {
        setItems(open);
        setSaved(done);
      })
      .catch((e) => onError(errMsg(e)));

  useEffect(() => {
    setItems([]);
    setOpenId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, kind, refreshKey]);

  const busy = items.some((i) => i.status === 'pending' || i.status === 'parsing');
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, memberId, kind]);

  // 정리가 막 끝난 것이 하나뿐이면 바로 열어 준다
  useEffect(() => {
    const ready = items.filter((i) => i.status === 'ready');
    if (!openId && ready.length === 1) setOpenId(ready[0].id);
  }, [items, openId]);

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const imp = await createImport(memberId, kind, text.trim());
      setItems((l) => [imp, ...l]);
      setText('');
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  const open = items.find((i) => i.id === openId && i.status === 'ready');

  return (
    <div className="import-inbox">
      <textarea rows={5} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} maxLength={60000} />
      <div className="row">
        <span className="panel-note" style={{ margin: 0, flex: 1 }}>{hint}</span>
        <button className="btn primary" disabled={!text.trim() || sending} onClick={submit}>AI로 정리</button>
      </div>

      {items.length > 0 && (
        <ul className="import-list">
          {items.map((i) => (
            <li key={i.id} className={i.id === openId ? 'active' : ''}>
              <button className="import-head" onClick={() => i.status === 'ready' && setOpenId(i.id === openId ? null : i.id)} disabled={i.status !== 'ready'}>
                <span className={`status-badge ${i.status === 'failed' ? 'concern' : i.status === 'ready' ? 'watch' : ''}`}>{STATUS[i.status]}</span>
                <span className="ellipsis">{i.raw_text.slice(0, 60).replace(/\s+/g, ' ')}</span>
                <span className="muted small">{when(i.created_at)}</span>
              </button>
              {i.status === 'failed' && (
                <div className="row" style={{ padding: '0 0 10px' }}>
                  <span className="err-text small" style={{ flex: 1 }}>{i.error}</span>
                  <button className="btn ghost small" onClick={() => retryImport(i.id).then(load)}>다시 시도</button>
                </div>
              )}
              {(i.status === 'failed' || i.status === 'ready' || i.status === 'pending') && i.id !== openId && (
                <button className="link-btn small" onClick={() => confirm('이 원문을 버릴까요?') && deleteImport(i.id).then(load)}>버리기</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="panel-note">보통 30초~1분 걸립니다. 화면을 닫아도 정리는 계속됩니다.</p>}

      {saved.length > 0 && (
        <div className="saved-imports">
          <h3 className="sub-title">저장한 입력 {saved.length}건</h3>
          <ul className="import-list">
            {(showAll ? saved : saved.slice(0, 3)).map((i) => (
              <li key={i.id}>
                <div className="import-head">
                  <span className="status-badge good">저장됨</span>
                  <span className="ellipsis">{i.raw_text.slice(0, 60).replace(/\s+/g, ' ')}</span>
                  <span className="muted small">{when(i.created_at)}</span>
                </div>
                <div className="row saved-actions">
                  <button className="link-btn small" onClick={() => setRawId(rawId === i.id ? null : i.id)}>{rawId === i.id ? '원문 닫기' : '원문'}</button>
                  {onOpenSaved && savedTo(i) && <button className="link-btn small" onClick={() => onOpenSaved(savedTo(i)!)}>저장된 기록 보기</button>}
                </div>
                {rawId === i.id && <pre className="raw-text" style={{ marginBottom: 10 }}>{i.raw_text}</pre>}
              </li>
            ))}
          </ul>
          {saved.length > 3 && <button className="link-btn small" onClick={() => setShowAll((v) => !v)}>{showAll ? '접기' : `모두 보기 (${saved.length})`}</button>}
        </div>
      )}

      {open &&
        renderReview(open, () => {
          setOpenId(null);
          load();
        })}
    </div>
  );
}
