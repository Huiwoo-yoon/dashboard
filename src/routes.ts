import type { ComponentType } from 'react';
import type { IconName } from './components/Icon';
import Home from './pages/Home';
import Todo from './pages/Todo';
import Workout from './pages/Workout';
import Meals from './pages/Meals';
import News from './pages/News';
import Market from './pages/Market';
import Health from './pages/Health';
import Checkup from './pages/Checkup';
import Cars from './pages/Cars';
import Illness from './pages/Illness';

export interface SubRoute {
  path: string;
  label: string;
  component: ComponentType;
}

export interface AppRoute {
  path: string;
  label: string;
  icon: IconName;
  /** 하위 메뉴가 없을 때의 화면 */
  component?: ComponentType;
  /** 하위 메뉴 (그룹 탭). 그룹 경로로 오면 첫 하위 메뉴로 보낸다 */
  children?: SubRoute[];
  /** true면 로그인해야 볼 수 있다 */
  requiresAuth: boolean;
}

/**
 * 메뉴 = 라우트. 여기 순서대로 사이드바/하단 탭바에 표시된다.
 * '/'는 로그인 상태면 첫 메뉴(Daily), 아니면 앱 서랍으로 보낸다 (App.tsx).
 */
export const routes: AppRoute[] = [
  {
    path: '/daily',
    label: 'Daily',
    icon: 'check',
    requiresAuth: true,
    children: [
      { path: '/daily/todo', label: 'Todo', component: Todo },
      { path: '/daily/workout', label: '운동', component: Workout },
      { path: '/daily/meals', label: '식단', component: Meals },
    ],
  },
  {
    path: '/manage',
    label: '관리',
    icon: 'heart',
    requiresAuth: true,
    children: [
      { path: '/manage/checkup', label: '건강 기록', component: Checkup },
      { path: '/manage/illness', label: '아플 때', component: Illness },
      { path: '/manage/weekly', label: '주간 리포트', component: Health },
      { path: '/manage/car', label: '차량', component: Cars },
    ],
  },
  { path: '/news', label: '소식', icon: 'news', component: News, requiresAuth: true },
  { path: '/market', label: '경제 동향', icon: 'trend', component: Market, requiresAuth: true },
  { path: '/apps', label: '앱 서랍', icon: 'grid', component: Home, requiresAuth: false },
];

/** 예전 주소 → 새 주소 (북마크 호환) */
export const legacyPaths: Record<string, string> = {
  '/todo': '/daily/todo',
  '/workout': '/daily/workout',
  '/meals': '/daily/meals',
  '/health': '/manage/weekly',
};
