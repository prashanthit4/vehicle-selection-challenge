// The only place the frontend reads build-time settings (Vite inlines these at dev/build time).
import { UPLOAD_PATH } from '@vehicle/shared/constants';

// Empty VITE_API_URL → same-origin POST (in dev, Vite proxies /upload to the backend).
export const UPLOAD_URL = `${import.meta.env.VITE_API_URL ?? ''}${UPLOAD_PATH}`;

// The backend's MAX_LOGBOOK_BYTES, injected by vite.config.ts, so form and server always agree.
export const MAX_LOGBOOK_BYTES: number = __MAX_LOGBOOK_BYTES__;
