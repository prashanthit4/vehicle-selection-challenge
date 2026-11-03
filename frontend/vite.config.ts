import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Relative (not @vehicle/shared) so Vite bundles them: Node can't load the package's .ts directly.
import { parseMaxSizeBytes } from '../shared/config';
import { UPLOAD_PATH } from '../shared/constants';

export default defineConfig(({ mode }) => {
  // backend/.env is the single source for the logbook limit (shell variables win, as they do for
  // the backend's dotenv). Nothing here is required: a fresh clone runs on the defaults.
  const backendEnv = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '');

  // The form posts to /upload on :5173 in dev, and Vite forwards it to the backend. Not derived
  // from PORT: tools that launch Vite often set PORT to Vite's own port.
  const backendUrl = loadEnv(mode, process.cwd(), '').DEV_BACKEND_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    // Baked into the frontend at dev/build time, so the upload input and Multer share one limit.
    define: {
      __MAX_LOGBOOK_BYTES__: JSON.stringify(parseMaxSizeBytes(backendEnv.MAX_LOGBOOK_BYTES)),
    },
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
