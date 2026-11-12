import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE: GitHub Pages 저장소 경로 (예: /DashBoard/). 로컬 개발은 기본값 '/'.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
  };
});
