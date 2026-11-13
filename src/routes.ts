import type { ComponentType } from 'react';
import type { IconName } from './components/Icon';
import Home from './pages/Home';
import Todo from './pages/Todo';
import Workout from './pages/Workout';
import Meals from './pages/Meals';
import News from './pages/News';
import Market from './pages/Market';
import Health from './pages/Health';

export interface AppRoute {
  path: string;
  label: string;
  icon: IconName;
  component: ComponentType;
  /** true면 로그인해야 볼 수 있다 */
  requiresAuth: boolean;
}

/**
 * 메뉴 = 라우트. 여기 순서대로 사이드바/하단 탭바에 표시된다.
 * '/'는 로그인 상태면 첫 메뉴(Todo), 아니면 앱 서랍으로 보낸다 (App.tsx).
 */
export const routes: AppRoute[] = [
  { path: '/todo', label: 'Todo', icon: 'check', component: Todo, requiresAuth: true },
  { path: '/workout', label: '운동', icon: 'activity', component: Workout, requiresAuth: true },
  { path: '/meals', label: '식단', icon: 'meal', component: Meals, requiresAuth: true },
  { path: '/health', label: '건강', icon: 'heart', component: Health, requiresAuth: true },
  { path: '/news', label: '소식', icon: 'news', component: News, requiresAuth: true },
  { path: '/market', label: '경제 동향', icon: 'trend', component: Market, requiresAuth: true },
  { path: '/apps', label: '앱 서랍', icon: 'grid', component: Home, requiresAuth: false },
];
