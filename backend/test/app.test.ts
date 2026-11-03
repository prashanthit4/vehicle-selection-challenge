import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  LOGBOOK_FIELD,
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
  UPLOAD_PATH,
} from '@vehicle/shared/constants';
import { formatResultPage } from '@vehicle/shared/templates';
import type { VehicleSelection } from '@vehicle/shared/types';
import { app } from '../src/app';
import { MAX_LOGBOOK_BYTES, UPLOAD_LIMITS } from '../src/config';

const vehicle: VehicleSelection = { make: 'bmw', model: '130d', badge: 'xDrive 26d' };
const logbookText = '2020/05/01: Initial Service\n2021/06/15: Check-Up';

interface UploadFile {
  content: string | Buffer;
  filename?: string;
  contentType?: string;
}

/** Posts multipart/form-data exactly like the browser form: text fields, then the logbook file. */
function postUpload(fields: Partial<VehicleSelection> = vehicle, file: UploadFile | null = { content: logbookText }) {
  const req = request(app).post(UPLOAD_PATH);
  for (const [name, value] of Object.entries(fields)) req.field(name, value);
  if (file) {
    req.attach(LOGBOOK_FIELD, Buffer.from(file.content), {
      filename: file.filename ?? 'logbook.txt',
      contentType: file.contentType ?? 'text/plain',
    });
  }
  return req;
}

describe('POST /upload', () => {
  it('renders the submission as a plain-text result page', async () => {
    const res = await postUpload();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.text).toBe(formatResultPage({ ...vehicle, logbookText }));
  });

  it('stops browsers from sniffing the echoed text as HTML', async () => {
    const res = await postUpload(vehicle, { content: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('accepts a logbook exactly at the size limit', async () => {
    const res = await postUpload(vehicle, { content: 'a'.repeat(MAX_LOGBOOK_BYTES) });
    expect(res.status).toBe(200);
  });

  it('accepts a .txt uploaded with the browser’s "unknown" type', async () => {
    const res = await postUpload(vehicle, { content: logbookText, contentType: 'application/octet-stream' });
    expect(res.status).toBe(200);
  });

  describe('logbook errors', () => {
    it('returns 400 "Please upload logbook" when no file is attached', async () => {
      const res = await postUpload(vehicle, null);

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/^text\/plain/);
      expect(res.text).toBe(LOGBOOK_REQUIRED_MESSAGE);
    });

    it.each(['', '  \n  '])('returns 400 "Please upload logbook" for an empty/blank file %j', async (content) => {
      const res = await postUpload(vehicle, { content });

      expect(res.status).toBe(400);
      expect(res.text).toBe(LOGBOOK_REQUIRED_MESSAGE);
    });

    it.each([
      ['a .pdf file', { filename: 'logbook.pdf', contentType: 'application/pdf' }],
      ['a .txt name with a PDF type', { contentType: 'application/pdf' }],
      ['a .md file sent as text/plain', { filename: 'logbook.md' }],
    ])('returns 400 "Logbook should be txt file" for %s', async (_case, overrides) => {
      const res = await postUpload(vehicle, { content: logbookText, ...overrides });

      expect(res.status).toBe(400);
      expect(res.text).toBe(LOGBOOK_TYPE_MESSAGE);
    });

    it('returns 400 "Logbook should be txt file" for binary content renamed to .txt', async () => {
      const res = await postUpload(vehicle, { content: Buffer.from([0xff, 0xfe, 0x00, 0x41]) });

      expect(res.status).toBe(400);
      expect(res.text).toBe(LOGBOOK_TYPE_MESSAGE);
    });

    it('returns 413 with the size message for a file over the limit', async () => {
      const res = await postUpload(vehicle, { content: 'a'.repeat(MAX_LOGBOOK_BYTES + 1) });

      expect(res.status).toBe(413);
      expect(res.text).toBe(logbookTooLargeMessage(MAX_LOGBOOK_BYTES));
    });
  });

  describe('field errors', () => {
    it('returns 400 for a vehicle that is not in the catalog', async () => {
      const res = await postUpload({ ...vehicle, make: 'tesla' });

      expect(res.status).toBe(400);
      expect(res.text).toBe('Unknown vehicle: tesla 130d xDrive 26d.');
    });

    it('returns 400 when vehicle fields are missing', async () => {
      const res = await postUpload({ make: 'bmw' });

      expect(res.status).toBe(400);
      expect(res.text).toBe('make, model and badge are required strings.');
    });
  });

  describe('Multer limits against malicious requests', () => {
    it('rejects a second file', async () => {
      const res = await postUpload().attach(LOGBOOK_FIELD, Buffer.from('again'), {
        filename: 'b.txt',
        contentType: 'text/plain',
      });

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('rejects a file under any other field name', async () => {
      const res = await postUpload(vehicle, null).attach('payload', Buffer.from(logbookText), {
        filename: 'logbook.txt',
        contentType: 'text/plain',
      });

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('rejects more text fields than the form sends', async () => {
      const res = await postUpload().field('extra', 'x');

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('rejects an oversized text field', async () => {
      const res = await postUpload({ ...vehicle, badge: 'x'.repeat(UPLOAD_LIMITS.fieldSize + 1) });

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('rejects an overlong field name', async () => {
      const res = await request(app).post(UPLOAD_PATH).field('f'.repeat(UPLOAD_LIMITS.fieldNameSize + 1), 'x');

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('rejects a truncated multipart body', async () => {
      const res = await request(app)
        .post(UPLOAD_PATH)
        .set('Content-Type', 'multipart/form-data; boundary=XYZ')
        .send('--XYZ\r\nContent-Disposition: form-data; name="make"\r\n\r\nbmw');

      expect(res.status).toBe(400);
      expect(res.text).toBe('Malformed upload.');
    });

    it('ignores non-multipart bodies: they are never parsed', async () => {
      const res = await request(app).post(UPLOAD_PATH).type('form').send({ ...vehicle, logbook: logbookText });

      expect(res.status).toBe(400);
      expect(res.text).toBe('make, model and badge are required strings.');
    });
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
