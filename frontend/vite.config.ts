import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Relative (not @vehicle/shared) so Vite bundles it: Node can't load the package's .ts directly.
import { UPLOAD_PATH } from '../shared/constants';

export default defineConfig(({ mode }) => {
  // Where the dev proxy forwards uploads. Defaults to the backend's default port, so a fresh
  // clone works with no .env: the form posts to /upload on :5173 and Vite passes it to Express.
  const backendUrl = loadEnv(mode, process.cwd(), '').DEV_BACKEND_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { [UPLOAD_PATH]: backendUrl },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
    },
  };
});
