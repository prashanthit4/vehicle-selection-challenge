import { describe, expect, it } from 'vitest';
import {
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import { MAX_LOGBOOK_BYTES } from '../../src/config';
import { validateSubmission, type LogbookUpload, type SubmissionInput } from '../../src/utils/validation';

const txt = (content: string | Buffer, fileName = 'logbook.txt', mimeType = 'text/plain'): LogbookUpload => ({
  fileName,
  mimeType,
  content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
});

const valid: SubmissionInput = {
  make: 'ford',
  model: 'Ranger',
  badge: 'Raptor',
  logbook: txt('10,000km service'),
};

describe('validateSubmission', () => {
  it('accepts a valid catalog combination and returns the decoded logbook text', () => {
    expect(validateSubmission(valid)).toEqual({
      ok: true,
      value: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookText: '10,000km service' },
    });
  });

  it('keeps the file’s text exactly, including CRLF line endings', () => {
    const result = validateSubmission({ ...valid, logbook: txt('line 1\r\nline 2') });
    expect(result.ok && result.value.logbookText).toBe('line 1\r\nline 2');
  });

  it('strips a UTF-8 byte-order mark', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('oil change')]);
    const result = validateSubmission({ ...valid, logbook: txt(withBom) });
    expect(result.ok && result.value.logbookText).toBe('oil change');
  });

  it.each(['make', 'model', 'badge'] as const)('rejects a missing, blank or non-string %s', (key) => {
    expect(validateSubmission({ ...valid, [key]: undefined }).ok).toBe(false);
    expect(validateSubmission({ ...valid, [key]: '   ' }).ok).toBe(false);
    expect(validateSubmission({ ...valid, [key]: 123 }).ok).toBe(false);
  });

  it('requires a logbook file', () => {
    expect(validateSubmission({ ...valid, logbook: undefined })).toEqual({
      ok: false,
      error: LOGBOOK_REQUIRED_MESSAGE,
    });
  });

  it.each(['', '   \n  '])('accepts an empty or whitespace-only file (%j): entries can come later', (content) => {
    expect(validateSubmission({ ...valid, logbook: txt(content) })).toEqual({
      ok: true,
      value: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookText: content },
    });
  });

  it('still rejects an empty file with the wrong type', () => {
    expect(validateSubmission({ ...valid, logbook: txt('', 'logbook.pdf', 'application/pdf') })).toEqual({
      ok: false,
      error: LOGBOOK_TYPE_MESSAGE,
    });
  });

  it.each([
    ['logbook.pdf', 'text/plain'],
    ['logbook.md', 'text/plain'],
    ['logbook.txt', 'application/pdf'],
    ['logbook', 'text/plain'],
  ])('rejects file name %j with type %j', (fileName, mimeType) => {
    expect(validateSubmission({ ...valid, logbook: txt('oil change', fileName, mimeType) })).toEqual({
      ok: false,
      error: LOGBOOK_TYPE_MESSAGE,
    });
  });

  it.each([
    ['LOGBOOK.TXT', 'text/plain'],
    ['logbook.txt', ''],
    ['logbook.txt', 'application/octet-stream'], // how browsers upload a file of unknown type
  ])('accepts file name %j with type %j', (fileName, mimeType) => {
    expect(validateSubmission({ ...valid, logbook: txt('oil change', fileName, mimeType) }).ok).toBe(true);
  });

  it.each([
    ['invalid UTF-8', Buffer.from([0xff, 0xfe, 0x00, 0x41])],
    ['NUL bytes', Buffer.from('MZ\u0000\u0000binary', 'utf8')],
  ])('rejects a .txt file whose content is not text (%s)', (_case, content) => {
    expect(validateSubmission({ ...valid, logbook: txt(content) })).toEqual({
      ok: false,
      error: LOGBOOK_TYPE_MESSAGE,
    });
  });

  it('accepts a logbook exactly at the limit', () => {
    expect(validateSubmission({ ...valid, logbook: txt('a'.repeat(MAX_LOGBOOK_BYTES)) }).ok).toBe(true);
  });

  it('rejects a logbook over the limit', () => {
    expect(validateSubmission({ ...valid, logbook: txt('a'.repeat(MAX_LOGBOOK_BYTES + 1)) })).toEqual({
      ok: false,
      error: logbookTooLargeMessage(MAX_LOGBOOK_BYTES),
    });
  });

  it('measures the limit in bytes, not characters', () => {
    // 'é' is 2 bytes in UTF-8, so this is under the limit in characters but over it in bytes.
    const content = 'é'.repeat(MAX_LOGBOOK_BYTES / 2 + 1);
    expect(validateSubmission({ ...valid, logbook: txt(content) }).ok).toBe(false);
  });

  it.each([
    { make: 'holden', model: 'Ranger', badge: 'Raptor' },
    { make: 'tesla', model: 'Ranger', badge: 'Raptor' },
    { make: 'ford', model: 'Falcon', badge: 'Raptor' },
    { make: 'Ford', model: 'Ranger', badge: 'Raptor' }, // keys are case-sensitive
  ])('rejects a combination not in the catalog: $make $model $badge', (vehicle) => {
    expect(validateSubmission({ ...valid, ...vehicle })).toEqual({
      ok: false,
      error: expect.stringContaining('Unknown vehicle'),
    });
  });
});
