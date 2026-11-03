import { describe, expect, it } from 'vitest';
import { MAX_LOGBOOK_BYTES } from '@vehicle/shared/utils';
import { validateSubmission } from '../../src/utils/validation';

const valid = { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookText: '10,000km service' };

describe('validateSubmission', () => {
  it('accepts a valid catalog combination', () => {
    expect(validateSubmission(valid)).toEqual({ ok: true, value: valid });
  });

  it.each(['', '   \n  '])('requires a logbook: rejects %j', (logbookText) => {
    expect(validateSubmission({ ...valid, logbookText })).toEqual({
      ok: false,
      error: 'Please upload logbook',
    });
  });

  it('strips unknown keys from the result', () => {
    const result = validateSubmission({ ...valid, extra: 'nope' });
    expect(result).toEqual({ ok: true, value: valid });
  });

  it.each([null, 'string', 42, []])('rejects a non-object body: %j', (body) => {
    expect(validateSubmission(body).ok).toBe(false);
  });

  it.each(['make', 'model', 'badge'] as const)('rejects a missing or blank %s', (key) => {
    expect(validateSubmission({ ...valid, [key]: undefined }).ok).toBe(false);
    expect(validateSubmission({ ...valid, [key]: '   ' }).ok).toBe(false);
    expect(validateSubmission({ ...valid, [key]: 123 }).ok).toBe(false);
  });

  it('accepts a logbook of exactly 1 MB', () => {
    expect(validateSubmission({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES) }).ok).toBe(true);
  });

  it('rejects a logbook over 1 MB', () => {
    const result = validateSubmission({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES + 1) });
    expect(result).toEqual({ ok: false, error: 'Logbook must be 1 MB or smaller.' });
  });

  it('measures the logbook limit in UTF-8 bytes, not characters', () => {
    // 'é' is 2 bytes in UTF-8, so this is under the limit in characters but over it in bytes.
    const text = 'é'.repeat(MAX_LOGBOOK_BYTES / 2 + 1);
    expect(validateSubmission({ ...valid, logbookText: text }).ok).toBe(false);
  });

  it('rejects a missing or non-string logbookText', () => {
    expect(validateSubmission({ ...valid, logbookText: undefined }).ok).toBe(false);
    expect(validateSubmission({ ...valid, logbookText: 5 }).ok).toBe(false);
  });

  it.each([
    { make: 'holden', model: 'Ranger', badge: 'Raptor' },
    { make: 'tesla', model: 'Ranger', badge: 'Raptor' },
    { make: 'ford', model: 'Falcon', badge: 'Raptor' },
    { make: 'Ford', model: 'Ranger', badge: 'Raptor' }, // keys are case-sensitive
  ])('rejects a combination not in the catalog: $make $model $badge', (vehicle) => {
    const result = validateSubmission({ ...vehicle, logbookText: 'oil change' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Unknown vehicle') });
  });
});
