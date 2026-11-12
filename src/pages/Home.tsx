import { useMemo, useState } from 'react';
import appsData from '../data/apps.json';
import { PageHeader, EmptyState, StatTile, Panel } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';

type Category = '게임' | '앱' | '자료' | '기타';
type Status = '사용중' | '개발중' | '보관';

interface AppEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  category: Category;
  icon: string;
  status: Status;
}

const apps = appsData as AppEntry[];

// 파일철: status 값 = 폴더. 상단 타일을 눌러 폴더를 연다.
const FOLDERS: { key: Status | '전체'; label: string; icon: IconName; note: string }[] = [
  { key: '사용중', label: '사용 중', icon: 'folder', note: '지금 쓰는 것' },
  { key: '개발중', label: '개발 중', icon: 'folder', note: '계속 만들어 갈 것' },
  { key: '보관', label: '보관', icon: 'folder', note: '안 쓰는 것' },
  { key: '전체', label: '전체', icon: 'grid', note: '모든 프로젝트' },
];
const CATEGORIES: (Category | '전체')[] = ['전체', '앱', '게임', '자료', '기타'];

export default function Home() {
  const [folder, setFolder] = useState<Status | '전체'>('사용중');
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter(
      (a) =>
        (folder === '전체' || a.status === folder) &&
        (category === '전체' || a.category === category) &&
        (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)),
    );
  }, [folder, category, query]);

  const countOf = (key: Status | '전체') => (key === '전체' ? apps.length : apps.filter((a) => a.status === key).length);
  const current = FOLDERS.find((f) => f.key === folder)!;

  return (
    <div>
      <PageHeader eyebrow="App Drawer" title="앱 서랍" subtitle="지금까지 만든 프로젝트를 용도와 상태별로 모아 둔 곳" />

      <div className="stats">
        {FOLDERS.map((f) => (
          <StatTile
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={countOf(f.key)}
            foot={f.note}
            active={folder === f.key}
            onClick={() => setFolder(f.key)}
          />
        ))}
      </div>

      <Panel flush title={`${current.label} 폴더`} subtitle={`${filtered.length}개 항목`}>
        <div className="drawer-tools">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input type="search" placeholder="이름이나 설명으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="chips" role="group" aria-label="카테고리">
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState>이 폴더에 해당하는 항목이 없습니다.</EmptyState>
        ) : (
          <ul className="app-list">
            {filtered.map((a) => (
              <li key={a.id}>
                <AppRow app={a} showStatus={folder === '전체'} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AppRow({ app, showStatus }: { app: AppEntry; showStatus: boolean }) {
  const body = (
    <>
      <div className="app-icon">{app.icon}</div>
      <div className="app-text">
        <div className="app-name">{app.name}</div>
        <div className="app-desc">{app.description}</div>
      </div>
      <div className="app-meta">
        <span className={`tag ${showStatus ? `status-${app.status}` : ''}`}>{showStatus ? app.status : app.category}</span>
        {app.url ? <Icon name="external" size={16} /> : <span className="local-note">로컬</span>}
      </div>
    </>
  );
  return app.url ? (
    <a className="app-row" href={app.url} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div className="app-row">{body}</div>
  );
}
