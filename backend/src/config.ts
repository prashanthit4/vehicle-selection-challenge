// The only place the backend reads process.env. index.ts loads .env before this module runs.
import { parseMaxSizeBytes } from '@vehicle/shared/config';

export const PORT = Number(process.env.PORT) || 3000;

export const MAX_LOGBOOK_BYTES = parseMaxSizeBytes(process.env.MAX_LOGBOOK_BYTES);

// The logbook limit is enforced in validation. The body cap sits well above it because
// URL-encoding the text (spaces, newlines, punctuation → %XX) can roughly triple its size.
// Derived by default, so raising MAX_LOGBOOK_BYTES alone can't make valid logbooks hit a 413.
export const MAX_BODY_SIZE: string | number = process.env.MAX_BODY_SIZE || 4 * MAX_LOGBOOK_BYTES;
