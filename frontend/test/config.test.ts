import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAX_LOGBOOK_BYTES } from '@vehicle/shared/config';

// config.ts reads import.meta.env at module load, so re-import it after stubbing.
async function loadConfig() {
  vi.resetModules();
  return import('../src/config');
}

afterEach(() => vi.unstubAllEnvs());

describe('frontend config', () => {
  it('gets the logbook limit injected from the backend’s MAX_LOGBOOK_BYTES', async () => {
    const { MAX_LOGBOOK_BYTES } = await loadConfig();
    expect(Number.isInteger(MAX_LOGBOOK_BYTES) && MAX_LOGBOOK_BYTES > 0).toBe(true);
    // Unset on a fresh clone, so this is the shared 1 MB default unless backend/.env changes it.
    if (!process.env.MAX_LOGBOOK_BYTES) expect(MAX_LOGBOOK_BYTES).toBe(DEFAULT_MAX_LOGBOOK_BYTES);
  });

  it('builds the upload URL from VITE_API_URL and the shared path', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    expect((await loadConfig()).UPLOAD_URL).toBe('https://api.example.test/upload');
  });
});
