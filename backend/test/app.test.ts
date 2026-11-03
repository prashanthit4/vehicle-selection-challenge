import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { MAX_LOGBOOK_BYTES } from '@vehicle/shared/utils';
import { app } from '../src/app';

const valid = {
  make: 'bmw',
  model: '130d',
  badge: 'xDrive 26d',
  logbookText: '2020/05/01: Initial Service\n2021/06/15: Check-Up',
};

// Sends the body the way a browser <form method="post"> does (application/x-www-form-urlencoded).
const postForm = (fields: Record<string, string>) => request(app).post('/upload').type('form').send(fields);

describe('POST /upload', () => {
  it('renders the submission as a plain-text result page', async () => {
    const res = await postForm(valid);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.text).toBe(
      [
        'Make: bmw',
        'Model: 130d',
        'Badge: xDrive 26d',
        '',
        'Logbook:',
        '',
        '2020/05/01: Initial Service',
        '2021/06/15: Check-Up',
        '',
      ].join('\n'),
    );
  });

  it('stops browsers from sniffing the echoed text as HTML', async () => {
    const res = await postForm({ ...valid, logbookText: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('turns the CRLF line breaks browsers send back into the file’s LF', async () => {
    const res = await postForm({ ...valid, logbookText: 'line 1\r\nline 2' });

    expect(res.text).toContain('Logbook:\n\nline 1\nline 2\n');
    expect(res.text).not.toContain('\r');
  });

  it('accepts a 1 MB logbook even though URL-encoding makes the body much bigger', async () => {
    // Every space and newline becomes %20 / %0A, so this request is roughly 2x the file size.
    const logbookText = 'a b\n'.repeat(MAX_LOGBOOK_BYTES / 4);
    const res = await postForm({ ...valid, logbookText });

    expect(res.status).toBe(200);
  });

  it('counts a CRLF file’s 1 MB after normalising, so browser line endings don’t push it over', async () => {
    // Sent as CRLF (as a browser would) this is over 1 MB; as the original LF file it is exactly 1 MB.
    const logbookText = 'abc\r\n'.repeat(MAX_LOGBOOK_BYTES / 4);
    const res = await postForm({ ...valid, logbookText });

    expect(res.status).toBe(200);
  });

  it('returns 400 with a plain-text message when the logbook is missing', async () => {
    const res = await postForm({ ...valid, logbookText: '' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toBe('Please upload logbook');
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

  it('returns 400 for a logbook over 1 MB', async () => {
    const res = await postForm({ ...valid, logbookText: 'a'.repeat(MAX_LOGBOOK_BYTES + 1) });

    expect(res.status).toBe(400);
    expect(res.text).toBe('Logbook must be 1 MB or smaller.');
  });

  it('returns 413 for a body over the 4 MB request limit', async () => {
    const res = await postForm({ ...valid, logbookText: 'a'.repeat(4 * 1024 * 1024 + 1) });

    expect(res.status).toBe(413);
    expect(res.text).toBe('Payload too large.');
  });

  it('ignores JSON bodies: the route only takes form posts', async () => {
    const res = await request(app).post('/upload').send(valid); // supertest sends JSON for objects

    // No JSON parser is registered, so the fields simply aren't seen.
    expect(res.status).toBe(400);
    expect(res.text).toBe('make, model and badge are required strings.');
  });
});

describe('other routes', () => {
  it.each([
    ['get', '/upload'],
    ['post', '/api/submit'],
  ] as const)('%s %s is not found', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(404);
  });
});
