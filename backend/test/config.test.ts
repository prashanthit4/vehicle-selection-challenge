import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('derives the body cap from the logbook limit unless MAX_BODY_SIZE is set', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '2048');
    vi.stubEnv('MAX_BODY_SIZE', '');
    expect((await loadConfig()).MAX_BODY_SIZE).toBe(4 * 2048);

    vi.stubEnv('MAX_BODY_SIZE', '10mb');
    expect((await loadConfig()).MAX_BODY_SIZE).toBe('10mb');
  });

  it('enforces a lowered limit end to end', async () => {
    vi.stubEnv('MAX_LOGBOOK_BYTES', '10');
    vi.resetModules();
    const { validateSubmission } = await import('../src/utils/validation');
    const result = validateSubmission({
      make: 'ford',
      model: 'Ranger',
      badge: 'Raptor',
      logbookText: 'eleven char',
      logbookFileName: 'logbook.txt',
      logbookMimeType: 'text/plain',
    });

    expect(result).toEqual({ ok: false, error: 'Logbook must be 10 bytes or smaller.' });
  });
});
