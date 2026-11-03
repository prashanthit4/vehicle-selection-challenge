// The only place the frontend reads import.meta.env (Vite inlines these at build time).
import { parseMaxSizeBytes } from '@vehicle/shared/config';
import { UPLOAD_PATH } from '@vehicle/shared/constants';

// Empty VITE_API_URL → same-origin POST (in dev, Vite proxies /upload to the backend).
export const UPLOAD_URL = `${import.meta.env.VITE_API_URL ?? ''}${UPLOAD_PATH}`;

export const MAX_LOGBOOK_BYTES = parseMaxSizeBytes(import.meta.env.VITE_MAX_LOGBOOK_BYTES);
