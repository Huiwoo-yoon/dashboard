import { useEffect, useState } from 'react';
import { getDigest, listDigestDates, type NewsDigest } from '../api/news';
import { addDays } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';

const CATEGORIES = ['경제', '문화', '세계', '과학', '의학', 'IT', '생활'];

/** "11월 9일 – 11월 15일" */
function weekRange(start: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-').map(Number);
    return `${m}월 ${day}일`;
  };
  return `${fmt(start)} – ${fmt(addDays(start, 6))}`;
}

export default function News() {
  const [weeks, setWeeks] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [digest, setDigest] = useState<NewsDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDigestDates()
      .then((w) => {
        setWeeks(w);
        setSelected(w[0] ?? null);
        if (w.length === 0) setLoading(false);
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
    getDigest(selected)
      .then((d) => !cancelled && setDigest(d))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const items = digest?.items ?? [];
  const topics = [...CATEGORIES, ...new Set(items.map((i) => i.topic || '기타'))].filter(
    (t, n, arr) => arr.indexOf(t) === n && items.some((i) => (i.topic || '기타') === t),
  );

  return (
    <div>
      <PageHeader
        eyebrow={selected ? weekRange(selected) : 'Weekly'}
        title="지난주 소식"
        subtitle="매일 보지 않아도 되게, 매주 월요일 아침 지난주(월~일) 주요 뉴스를 분야별로 정리합니다"
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="day-layout">
        <div className="day-side">
          <Panel flush title="지난 호">
            {weeks && weeks.length > 0 ? (
              weeks.map((w) => (
                <button key={w} className={`week-item${w === selected ? ' active' : ''}`} onClick={() => setSelected(w)}>
                  {weekRange(w)}
                </button>
              ))
            ) : (
              <p className="panel-note">아직 없습니다</p>
            )}
          </Panel>
        </div>

        <div>
          {loading ? (
            <Panel><div className="muted">불러오는 중…</div></Panel>
          ) : !digest ? (
            <Panel>
              <EmptyState>
                아직 정리된 주간 소식이 없습니다.
                <span className="small">맥미니가 매일 제목만 모아 두었다가 매주 월요일 07:00에 정리합니다.</span>
              </EmptyState>
            </Panel>
          ) : (
            <>
              <Panel title="한 주 요약" subtitle={`${items.length}개 기사 · AI 정리`}>
                <p className="news-summary">{digest.summary}</p>
              </Panel>
              {topics.map((topic) => (
                <Panel key={topic} flush title={topic}>
                  {items
                    .filter((i) => (i.topic || '기타') === topic)
                    .map((i) => (
                      <a key={i.url} className="news-item" href={i.url} target="_blank" rel="noopener noreferrer">
                        <span className="src">{i.source}</span>
                        <span>
                          <span className="ttl">{i.title}</span>
                          {i.note && <span className="note">{i.note}</span>}
                        </span>
                      </a>
                    ))}
                </Panel>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
