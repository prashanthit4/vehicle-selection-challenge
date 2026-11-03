import { describe, expect, it } from 'vitest';
import {
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import type { VehicleSubmission } from '@vehicle/shared/types';
import { MAX_LOGBOOK_BYTES } from '../../src/config';
import { validateSubmission } from '../../src/utils/validation';

const valid: VehicleSubmission = {
  make: 'ford',
  model: 'Ranger',
  badge: 'Raptor',
  logbookText: '10,000km service',
  logbookFileName: 'logbook.txt',
  logbookMimeType: 'text/plain',
};

describe('validateSubmission', () => {
  it('accepts a valid catalog combination', () => {
    expect(validateSubmission(valid)).toEqual({ ok: true, value: valid });
  });

  it.each(['', '   \n  '])('requires a logbook: rejects %j', (logbookText) => {
    expect(validateSubmission({ ...valid, logbookText })).toEqual({
      ok: false,
      error: LOGBOOK_REQUIRED_MESSAGE,
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

  it('accepts a logbook exactly at the limit', () => {
    expect(validateSubmission({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES) }).ok).toBe(true);
  });

  it('rejects a logbook over the limit', () => {
    const result = validateSubmission({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES + 1) });
    expect(result).toEqual({ ok: false, error: logbookTooLargeMessage(MAX_LOGBOOK_BYTES) });
  });

  it.each([
    ['logbook.pdf', 'text/plain'],
    ['logbook.md', 'text/plain'],
    ['logbook.txt', 'application/pdf'],
    [undefined, 'text/plain'],
    ['logbook.txt', undefined],
  ])('rejects file name %j with type %j', (logbookFileName, logbookMimeType) => {
    expect(validateSubmission({ ...valid, logbookFileName, logbookMimeType })).toEqual({
      ok: false,
      error: LOGBOOK_TYPE_MESSAGE,
    });
  });

  it.each([
    ['LOGBOOK.TXT', 'text/plain'],
    ['logbook.txt', ''], // browsers send an empty type for files they don't recognise
  ])('accepts file name %j with type %j', (logbookFileName, logbookMimeType) => {
    expect(validateSubmission({ ...valid, logbookFileName, logbookMimeType }).ok).toBe(true);
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
    const result = validateSubmission({ ...valid, ...vehicle });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Unknown vehicle') });
  });
});
