import { NavLink } from 'react-router-dom';
import type { AppRoute } from '../routes';

/** 그룹 탭 안의 하위 메뉴 (폰에서만 보임 — 데스크톱은 사이드바에 표시) */
export function SubNav({ group }: { group: AppRoute }) {
  return (
    <nav className="subnav" aria-label={`${group.label} 메뉴`}>
      {group.children?.map((c) => (
        <NavLink key={c.path} to={c.path} className="subnav-link">
          {c.label}
        </NavLink>
      ))}
    </nav>
  );
}
