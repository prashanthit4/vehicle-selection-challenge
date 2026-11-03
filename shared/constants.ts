// Domain constants and user-facing messages, so the frontend and backend can't drift apart.
import { formatBytes } from './config';

/** Route the form posts to and the backend serves the result page from. */
export const UPLOAD_PATH = '/upload';

export const ALLOWED_EXTENSIONS: readonly string[] = ['.txt'];
export const ALLOWED_MIME_TYPES: readonly string[] = ['text/plain'];

/** Value for the file input's `accept` attribute. */
export const LOGBOOK_ACCEPT = [...ALLOWED_EXTENSIONS, ...ALLOWED_MIME_TYPES].join(',');

export const hasAllowedExtension = (fileName: string): boolean =>
  ALLOWED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));

/**
 * Browsers report an empty type when they don't recognise a file, so only an explicit
 * mismatch is rejected. The extension check is the primary gate.
 */
export const hasAllowedMimeType = (mimeType: string): boolean =>
  mimeType === '' || ALLOWED_MIME_TYPES.includes(mimeType);

export const LOGBOOK_REQUIRED_MESSAGE = 'Please upload logbook';
export const LOGBOOK_READ_ERROR_MESSAGE = 'Could not read the logbook file.';

/** "Logbook should be txt file" for ['.txt']. */
export const LOGBOOK_TYPE_MESSAGE = `Logbook should be ${ALLOWED_EXTENSIONS.map((ext) => ext.replace(/^\./, '')).join(' or ')} file`;

export const logbookTooLargeMessage = (maxBytes: number): string =>
  `Logbook must be ${formatBytes(maxBytes)} or smaller.`;
