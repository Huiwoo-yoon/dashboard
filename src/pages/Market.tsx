import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addSymbol,
  deleteSymbol,
  getHistory,
  listQuotes,
  listSymbols,
  type MarketQuote,
  type MarketSymbol,
  type Point,
  type RangeKey,
} from '../api/market';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { Icon } from '../components/Icon';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1d', label: '일' },
  { key: '5d', label: '주' },
  { key: '1mo', label: '월' },
  { key: '1y', label: '연' },
  { key: '5y', label: '5년' },
  { key: 'max', label: '최대' },
];

/** 종목에 맞는 숫자 표시 (원화 주식은 소수점 없이, 지수·환율은 소수 2자리) */
function formatter(symbol: string, currency: string | null) {
  const isIndex = symbol.startsWith('^');
  const isFx = symbol.endsWith('=X');
  const digits = currency === 'KRW' && !isIndex && !isFx ? 0 : 2;
  const num = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (v: number) => {
    if (isIndex) return num(v);
    if (currency === 'KRW') return `${num(v)}원`;
    if (currency === 'USD') return `$${num(v)}`;
    return `${num(v)}${currency ? ` ${currency}` : ''}`;
  };
}

function Change({ price, prev, format }: { price: number; prev: number; format: (v: number) => string }) {
  const diff = price - prev;
  const pct = prev ? (diff / prev) * 100 : 0;
  const cls = diff > 0 ? 'rise' : diff < 0 ? 'fall' : 'flat';
  const sign = diff > 0 ? '▲' : diff < 0 ? '▼' : '';
  return (
    <span className={cls}>
      {sign} {format(Math.abs(diff)).replace(/^\$/, '')} ({diff > 0 ? '+' : ''}{pct.toFixed(2)}%)
    </span>
  );
}

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export default function Market() {
  const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('1mo');
  const [history, setHistory] = useState<Partial<Record<RangeKey, Point[]>>>({});
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState({ symbol: '', label: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [s, q] = await Promise.all([listSymbols(), listQuotes()]);
    setSymbols(s);
    setQuotes(Object.fromEntries(q.map((x) => [x.symbol, x])));
    setSelected((cur) => (cur && s.some((x) => x.symbol === cur) ? cur : s[0]?.symbol ?? null));
  };

  useEffect(() => {
    load()
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setHistory({});
    getHistory(selected)
      .then((h) => !cancelled && setHistory(h))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const sel = symbols.find((s) => s.symbol === selected) ?? null;
  const selQuote = selected ? quotes[selected] : undefined;
  const fmt = useMemo(() => formatter(selected ?? '', selQuote?.currency ?? null), [selected, selQuote?.currency]);
  const points = history[range] ?? [];
  const periodDiff = points.length > 1 ? points[points.length - 1][1] - points[0][1] : 0;
  const latest = Object.values(quotes).reduce<string | null>((a, q) => (q.price != null && (!a || q.updated_at > a) ? q.updated_at : a), null);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const symbol = draft.symbol.trim().toUpperCase();
    const label = draft.label.trim() || symbol;
    if (!symbol) return;
    try {
      const s = await addSymbol(symbol, label, Math.max(0, ...symbols.map((x) => x.sort_order)) + 1);
      setSymbols((cur) => [...cur, s]);
      setDraft({ symbol: '', label: '' });
    } catch (err) {
      setError(errMsg(err).includes('duplicate') ? '이미 추가된 종목입니다' : errMsg(err));
    }
  };

  const onDelete = async (s: MarketSymbol) => {
    if (!confirm(`'${s.label}'을(를) 목록에서 뺄까요?`)) return;
    try {
      await deleteSymbol(s.id);
      setSymbols((cur) => cur.filter((x) => x.id !== s.id));
      if (selected === s.symbol) setSelected(symbols.find((x) => x.id !== s.id)?.symbol ?? null);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={latest ? `${timeLabel(latest)} 업데이트` : 'Markets'}
        title="경제 동향"
        subtitle="직전 거래일 기준 시세 · 맥미니가 매일 07:30, 16:30에 갱신합니다"
        right={
          <button className={`btn small${managing ? ' primary' : ''}`} onClick={() => setManaging((m) => !m)}>
            {managing ? '완료' : <><Icon name="edit" size={16} /> 편집</>}
          </button>
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      {managing && (
        <Panel title="종목 추가" subtitle="Yahoo Finance 티커로 입력합니다. 추가하면 10분 안에 시세가 채워집니다.">
          <form className="add-form" onSubmit={onAdd}>
            <div className="field-grid">
              <input placeholder="티커 (예: AAPL, 000660.KS)" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} maxLength={30} autoCapitalize="characters" />
              <input placeholder="표시 이름 (예: SK하이닉스)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={40} />
            </div>
            <div className="row">
              <span className="muted small" style={{ flex: 1 }}>
                예) 미국 주식 AAPL · 코스피 종목 000660.KS · 코스닥 종목 247540.KQ · 금 GC=F · 엔화 JPYKRW=X · 비트코인(원화) BTC-KRW
              </span>
              <button className="btn primary" disabled={!draft.symbol.trim()}><Icon name="plus" size={18} /> 추가</button>
            </div>
          </form>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="muted">불러오는 중…</div></Panel>
      ) : symbols.length === 0 ? (
        <Panel>
          <EmptyState>
            관심 종목이 없습니다.
            <button className="btn primary" onClick={() => setManaging(true)}>종목 추가</button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="quote-grid">
          {symbols.map((s) => {
            const q = quotes[s.symbol];
            const f = formatter(s.symbol, q?.currency ?? null);
            return (
              <div key={s.id} className="quote-cell">
                <button className={`stat quote${selected === s.symbol ? ' active' : ''}`} onClick={() => setSelected(s.symbol)}>
                  <div className="stat-label">{s.label}</div>
                  {q?.price != null ? (
                    <>
                      <div className="stat-value">{f(q.price)}</div>
                      <div className="stat-foot">{q.prev_close != null && <Change price={q.price} prev={q.prev_close} format={f} />}</div>
                    </>
                  ) : q?.error ? (
                    <div className="stat-foot err-text">티커를 확인해 주세요</div>
                  ) : (
                    <div className="stat-foot">시세 준비 중 · 10분 안에 표시</div>
                  )}
                </button>
                {managing && (
                  <button className="quote-del" aria-label={`${s.label} 삭제`} onClick={() => onDelete(s)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sel && selQuote?.price != null && (
        <Panel
          title={sel.label}
          subtitle={`${selQuote.name ?? sel.symbol} · ${sel.symbol}${selQuote.market_time ? ` · ${timeLabel(selQuote.market_time)} 기준` : ''}`}
          right={
            points.length > 1 ? (
              <span className={`period-change ${periodDiff > 0 ? 'rise' : periodDiff < 0 ? 'fall' : 'flat'}`}>
                {periodDiff > 0 ? '+' : ''}{((periodDiff / points[0][1]) * 100).toFixed(2)}%
              </span>
            ) : undefined
          }
        >
          <div className="segmented" role="tablist" aria-label="기간">
            {RANGES.map((r) => (
              <button key={r.key} role="tab" aria-selected={range === r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <LineChart
            points={points}
            range={range}
            color={periodDiff >= 0 ? 'var(--rise)' : 'var(--fall)'}
            format={fmt}
            label={sel.label}
          />
        </Panel>
      )}
    </div>
  );
}
