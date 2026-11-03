import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Pinned so the tests don't depend on a developer's local .env.
    env: {
      VITE_QUICK_SELECTS: '["tesla-Model 3-Performance","bmw-130d-xDrive 26d"]',
    },
  },
});
