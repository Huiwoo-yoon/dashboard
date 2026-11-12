import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** 상단 요약 숫자 타일 */
export function StatTile({
  label,
  value,
  foot,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon?: IconName;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="stat-label">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </>
  );
  return onClick ? (
    <button className={`stat ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      {body}
    </button>
  ) : (
    <div className="stat">{body}</div>
  );
}

/** 제목이 있는 카드 섹션 */
export function Panel({
  title,
  subtitle,
  right,
  children,
  flush,
}: {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`panel ${flush ? 'flush' : ''}`}>
      {(title || right) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBanner({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button className="icon-btn" onClick={onClose} aria-label="닫기">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** 에러 객체 → 화면용 메시지 */
export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return '알 수 없는 오류가 발생했습니다.';
}
