/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MAX_LOGBOOK_BYTES?: string;
  /** JSON array of "make-model-badge" strings. */
  readonly VITE_QUICK_SELECTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
