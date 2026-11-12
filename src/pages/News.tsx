import { useEffect, useState } from 'react';
import { getDigest, listDigestDates, type NewsDigest } from '../api/news';
import { formatKoreanDate, monthEnd, monthStart, todaySeoul } from '../lib/date';
import { PageHeader, ErrorBanner, EmptyState, Panel, errMsg } from '../components/ui';
import { Calendar, type DayMark } from '../components/Calendar';

export default function News() {
  const today = todaySeoul();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthStart(today));
  const [digest, setDigest] = useState<NewsDigest | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDigestDates(monthStart(month), monthEnd(month)).then(setDates).catch((e) => setError(errMsg(e)));
  }, [month]);

  useEffect(() => {
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

  const marks: Record<string, DayMark> = Object.fromEntries(dates.map((d) => [d, { dot: true }]));
  const items = digest?.items ?? [];
  const topics = [...new Set(items.map((i) => i.topic || '기타'))];

  return (
    <div>
      <PageHeader
        eyebrow={formatKoreanDate(selected)}
        title={selected === today ? '오늘의 소식' : '그날의 소식'}
        subtitle="맥미니가 매일 아침 주요 뉴스를 모아 요약합니다"
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <div className="day-layout">
        <div className="day-side">
          <Panel>
            <Calendar month={month} selected={selected} marks={marks} onSelect={(d) => { setSelected(d); setMonth(monthStart(d)); }} onMonthChange={setMonth} />
            <p className="panel-note">점 = 소식이 있는 날</p>
          </Panel>
        </div>

        <div>
          {loading ? (
            <Panel><div className="muted">불러오는 중…</div></Panel>
          ) : !digest ? (
            <Panel>
              <EmptyState>
                이날 모은 소식이 없습니다.
                <span className="small">맥미니의 daily 스크립트가 매일 07:00에 실행됩니다.</span>
              </EmptyState>
            </Panel>
          ) : (
            <>
              <Panel title="요약" subtitle={`${items.length}개 기사 기준 · AI 요약`}>
                <p className="news-summary">{digest.summary}</p>
              </Panel>
              {topics.map((topic) => (
                <Panel key={topic} flush title={topic}>
                  {items
                    .filter((i) => (i.topic || '기타') === topic)
                    .map((i) => (
                      <a key={i.url} className="news-item" href={i.url} target="_blank" rel="noopener noreferrer">
                        <span className="src">{i.source}</span>
                        <span className="ttl">{i.title}</span>
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
