/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MAX_LOGBOOK_BYTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
