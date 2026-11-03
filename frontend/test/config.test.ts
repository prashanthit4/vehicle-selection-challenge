import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAX_LOGBOOK_BYTES } from '@vehicle/shared/config';

// config.ts reads import.meta.env at module load, so re-import it after stubbing.
async function loadConfig() {
  vi.resetModules();
  return import('../src/config');
}

afterEach(() => vi.unstubAllEnvs());

describe('frontend config', () => {
  it('reads the logbook limit from VITE_MAX_LOGBOOK_BYTES', async () => {
    vi.stubEnv('VITE_MAX_LOGBOOK_BYTES', '2048');
    expect((await loadConfig()).MAX_LOGBOOK_BYTES).toBe(2048);
  });

  it.each(['', 'lots', '1mb'])('falls back to the shared default for %j', async (value) => {
    vi.stubEnv('VITE_MAX_LOGBOOK_BYTES', value);
    expect((await loadConfig()).MAX_LOGBOOK_BYTES).toBe(DEFAULT_MAX_LOGBOOK_BYTES);
  });

  it('builds the upload URL from VITE_API_URL and the shared path', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    expect((await loadConfig()).UPLOAD_URL).toBe('https://api.example.test/upload');
  });
});
