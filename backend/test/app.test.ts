import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
  UPLOAD_PATH,
} from '@vehicle/shared/constants';
import { formatResultPage } from '@vehicle/shared/templates';
import type { VehicleSubmission } from '@vehicle/shared/types';
import { app } from '../src/app';
import { MAX_BODY_SIZE, MAX_LOGBOOK_BYTES } from '../src/config';

const valid: VehicleSubmission = {
  make: 'bmw',
  model: '130d',
  badge: 'xDrive 26d',
  logbookText: '2020/05/01: Initial Service\n2021/06/15: Check-Up',
  logbookFileName: 'logbook.txt',
  logbookMimeType: 'text/plain',
};

// Sends the body the way a browser <form method="post"> does (application/x-www-form-urlencoded).
const postForm = (fields: Partial<Record<keyof VehicleSubmission, string>>) =>
  request(app).post(UPLOAD_PATH).type('form').send(fields);

describe('POST /upload', () => {
  it('renders the submission as a plain-text result page', async () => {
    const res = await postForm(valid);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.text).toBe(formatResultPage(valid));
  });

  it('stops browsers from sniffing the echoed text as HTML', async () => {
    const res = await postForm({ ...valid, logbookText: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('turns the CRLF line breaks browsers send back into the file’s LF', async () => {
    const res = await postForm({ ...valid, logbookText: 'line 1\r\nline 2' });

    expect(res.text).toBe(formatResultPage({ ...valid, logbookText: 'line 1\nline 2' }));
    expect(res.text).not.toContain('\r');
  });

  it('accepts a max-size logbook even though URL-encoding makes the body much bigger', async () => {
    // Every space and newline becomes %20 / %0A, so this request is roughly 2x the file size.
    const logbookText = 'a b\n'.repeat(MAX_LOGBOOK_BYTES / 4);
    const res = await postForm({ ...valid, logbookText });

    expect(res.status).toBe(200);
  });

  it('counts a CRLF file’s size after normalising, so browser line endings don’t push it over', async () => {
    // Sent as CRLF (as a browser would) this is over the limit; as the original LF file it is exactly at it.
    const logbookText = 'abc\r\n'.repeat(MAX_LOGBOOK_BYTES / 4);
    const res = await postForm({ ...valid, logbookText });

    expect(res.status).toBe(200);
  });

  it('returns 400 with a plain-text message when the logbook is missing', async () => {
    const res = await postForm({ ...valid, logbookText: '' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toBe(LOGBOOK_REQUIRED_MESSAGE);
  });

  it('returns 400 for a vehicle that is not in the catalog', async () => {
    const res = await postForm({ ...valid, make: 'tesla' });

    expect(res.status).toBe(400);
    expect(res.text).toBe('Unknown vehicle: tesla 130d xDrive 26d.');
  });

  it('returns 400 when fields are missing', async () => {
    const res = await postForm({ make: 'bmw' });

    expect(res.status).toBe(400);
    expect(res.text).toBe('make, model and badge are required strings.');
  });

  it('returns 400 for a logbook over the configured limit', async () => {
    const res = await postForm({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES + 1) });

    expect(res.status).toBe(400);
    expect(res.text).toBe(logbookTooLargeMessage(MAX_LOGBOOK_BYTES));
  });

  it.each([
    ['a non-.txt file name', { logbookFileName: 'logbook.pdf' }],
    ['a disallowed MIME type', { logbookMimeType: 'application/pdf' }],
    ['a missing file name', { logbookFileName: undefined }],
  ])('returns 400 for %s', async (_case, override) => {
    const res = await postForm({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.text).toBe(LOGBOOK_TYPE_MESSAGE);
  });

  it('returns 413 for a body over the request limit', async () => {
    expect(MAX_BODY_SIZE).toBe(4 * MAX_LOGBOOK_BYTES); // default when MAX_BODY_SIZE is unset
    const res = await postForm({ ...valid, logbookText: 'a'.repeat(4 * MAX_LOGBOOK_BYTES + 1) });

    expect(res.status).toBe(413);
    expect(res.text).toBe('Payload too large.');
  });

  it('ignores JSON bodies: the route only takes form posts', async () => {
    const res = await request(app).post(UPLOAD_PATH).send(valid); // supertest sends JSON for objects

    // No JSON parser is registered, so the fields simply aren't seen.
    expect(res.status).toBe(400);
    expect(res.text).toBe('make, model and badge are required strings.');
  });
});

describe('other routes', () => {
  it.each([
    ['get', UPLOAD_PATH],
    ['post', '/api/submit'],
  ] as const)('%s %s is not found', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(404);
  });
});
