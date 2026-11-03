// Domain constants and user-facing messages, so the frontend and backend can't drift apart.
import { formatBytes } from './config';

/** Route the form posts to and the backend serves the result page from. */
export const UPLOAD_PATH = '/upload';

/** Multipart field name of the logbook file. */
export const LOGBOOK_FIELD = 'logbook';

export const ALLOWED_EXTENSIONS: readonly string[] = ['.txt'];
export const ALLOWED_MIME_TYPES: readonly string[] = ['text/plain'];

/** Value for the file input's `accept` attribute. */
export const LOGBOOK_ACCEPT = [...ALLOWED_EXTENSIONS, ...ALLOWED_MIME_TYPES].join(',');

export const hasAllowedExtension = (fileName: string): boolean =>
  ALLOWED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));

/**
 * Types browsers use for "unknown": File.type is '' in the page, and the same file is sent
 * as application/octet-stream in a multipart upload.
 */
const UNKNOWN_MIME_TYPES: readonly string[] = ['', 'application/octet-stream'];

/**
 * Only an explicit mismatch is rejected; an unknown type is allowed. The extension check is the
 * primary gate, and the server additionally verifies the content is UTF-8 text.
 */
export const hasAllowedMimeType = (mimeType: string): boolean =>
  UNKNOWN_MIME_TYPES.includes(mimeType) || ALLOWED_MIME_TYPES.includes(mimeType);

export const LOGBOOK_REQUIRED_MESSAGE = 'Please upload logbook';

/** "Logbook should be txt file" for ['.txt']. */
export const LOGBOOK_TYPE_MESSAGE = `Logbook should be ${ALLOWED_EXTENSIONS.map((ext) => ext.replace(/^\./, '')).join(' or ')} file`;

export const logbookTooLargeMessage = (maxBytes: number): string =>
  `Logbook must be ${formatBytes(maxBytes)} or smaller.`;
