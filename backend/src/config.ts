// The only place the backend reads process.env. index.ts loads .env before this module runs.
import type { Options } from 'multer';
import { parseMaxSizeBytes } from '@vehicle/shared/config';

export const PORT = Number(process.env.PORT) || 3000;

export const MAX_LOGBOOK_BYTES = parseMaxSizeBytes(process.env.MAX_LOGBOOK_BYTES);

/**
 * Multer limits for POST /upload. Every dimension a client controls is capped, not just the
 * file size, so a malicious request can't exhaust memory with huge or numerous fields/parts.
 * The form sends exactly three short text fields (make, model, badge) and one file.
 */
export const UPLOAD_LIMITS = {
  fileSize: MAX_LOGBOOK_BYTES, // bytes; the file is buffered in memory, so this bounds RAM per request
  files: 1,
  fields: 3,
  fieldSize: 256, // bytes per text value; catalog names are far shorter
  fieldNameSize: 32,
  parts: 4, // 3 fields + 1 file
  headerPairs: 20,
} satisfies Options['limits'];
