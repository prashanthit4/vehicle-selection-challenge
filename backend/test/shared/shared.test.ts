// Tests for the @vehicle/shared package, run in the backend's Node test environment.
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_LOGBOOK_BYTES, formatBytes, parseMaxSizeBytes } from '@vehicle/shared/config';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  hasAllowedExtension,
  hasAllowedMimeType,
  LOGBOOK_ACCEPT,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import { formatResultPage } from '@vehicle/shared/templates';

describe('parseMaxSizeBytes', () => {
  it('parses a whole number of bytes', () => {
    expect(parseMaxSizeBytes('524288')).toBe(524288);
    expect(parseMaxSizeBytes(' 2048 ')).toBe(2048);
  });

  it.each([undefined, '', 'abc', '1mb', '1.5', '-5', '0'])('falls back to the default for %j', (value) => {
    expect(parseMaxSizeBytes(value)).toBe(DEFAULT_MAX_LOGBOOK_BYTES);
  });

  it('defaults to 1 MB', () => {
    expect(DEFAULT_MAX_LOGBOOK_BYTES).toBe(1024 * 1024);
  });
});

describe('formatBytes', () => {
  it.each([
    [1048576, '1 MB'],
    [2 * 1048576, '2 MB'],
    [524288, '512 KB'],
    [1500, '1500 bytes'],
  ])('%i → %s', (bytes, label) => {
    expect(formatBytes(bytes)).toBe(label);
  });
});

describe('file-type constants', () => {
  it('allow .txt / text/plain only', () => {
    expect(ALLOWED_EXTENSIONS).toEqual(['.txt']);
    expect(ALLOWED_MIME_TYPES).toEqual(['text/plain']);
    expect(LOGBOOK_ACCEPT).toBe('.txt,text/plain');
  });

  it('match extensions case-insensitively', () => {
    expect(hasAllowedExtension('a.TXT')).toBe(true);
    expect(hasAllowedExtension('a.txt.pdf')).toBe(false);
    expect(hasAllowedExtension('txt')).toBe(false);
  });

  it('allow an unknown (empty) MIME type but reject an explicit mismatch', () => {
    expect(hasAllowedMimeType('')).toBe(true);
    expect(hasAllowedMimeType('text/plain')).toBe(true);
    expect(hasAllowedMimeType('text/markdown')).toBe(false);
  });
});

describe('messages', () => {
  it('keep the exact wording users see', () => {
    expect(LOGBOOK_TYPE_MESSAGE).toBe('Logbook should be txt file');
    expect(logbookTooLargeMessage(1048576)).toBe('Logbook must be 1 MB or smaller.');
    expect(logbookTooLargeMessage(524288)).toBe('Logbook must be 512 KB or smaller.');
  });
});

describe('formatResultPage', () => {
  // Pinned literally: the code and the HTTP tests share this template, so this guards the format itself.
  it('matches the reference /upload layout exactly', () => {
    const page = formatResultPage({
      make: 'bmw',
      model: '130d',
      badge: 'xDrive 26d',
      logbookText: '2020/05/01: Initial Service\n2021/06/15: Check-Up',
    });

    expect(page).toBe(
      'Make: bmw\nModel: 130d\nBadge: xDrive 26d\n\nLogbook:\n\n2020/05/01: Initial Service\n2021/06/15: Check-Up\n',
    );
  });
});
