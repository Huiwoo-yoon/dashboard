import type { ComponentType } from 'react';
import type { IconName } from './components/Icon';
import Home from './pages/Home';
import Todo from './pages/Todo';
import Workout from './pages/Workout';
import Meals from './pages/Meals';

export interface AppRoute {
  path: string;
  label: string;
  icon: IconName;
  component: ComponentType;
  /** true면 로그인해야 볼 수 있다 */
  requiresAuth: boolean;
}

/**
 * 메뉴 = 라우트. 새 페이지(뉴스, 시세 등)는 여기에 한 줄 추가하면
 * 사이드바/하단 탭바/라우터에 함께 반영된다.
 */
export const routes: AppRoute[] = [
  { path: '/', label: '앱 서랍', icon: 'grid', component: Home, requiresAuth: false },
  { path: '/todo', label: 'Todo', icon: 'check', component: Todo, requiresAuth: true },
  { path: '/workout', label: '운동', icon: 'activity', component: Workout, requiresAuth: true },
  { path: '/meals', label: '식단', icon: 'meal', component: Meals, requiresAuth: true },
];
