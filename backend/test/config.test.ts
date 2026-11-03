import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { DEFAULT_MAX_LOGBOOK_BYTES } from '@vehicle/shared/config';

// config.ts reads process.env at module load, so re-import it after stubbing.
async function loadConfig() {
  vi.resetModules();
  return import('../src/config');
}

afterEach(() => vi.unstubAllEnvs());

describe('backend config', () => {
  it('reads the logbook limit from MAX_LOGBOOK_BYTES', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '2048');
    expect((await loadConfig()).MAX_LOGBOOK_BYTES).toBe(2048);
  });

  it('falls back to the shared default for an invalid value', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '1mb');
    expect((await loadConfig()).MAX_LOGBOOK_BYTES).toBe(DEFAULT_MAX_LOGBOOK_BYTES);
  });

  it('caps Multer’s file size at the logbook limit', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '2048');
    expect((await loadConfig()).UPLOAD_LIMITS.fileSize).toBe(2048);
  });

  it('enforces a lowered limit end to end over HTTP', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '10');
    vi.resetModules();
    const { app } = await import('../src/app');

    const res = await request(app)
      .post('/upload')
      .field('make', 'ford')
      .field('model', 'Ranger')
      .field('badge', 'Raptor')
      .attach('logbook', Buffer.from('eleven char'), { filename: 'logbook.txt', contentType: 'text/plain' });

    expect(res.status).toBe(413);
    expect(res.text).toBe('Logbook must be 10 bytes or smaller.');
  });
});
