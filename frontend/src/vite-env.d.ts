/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The backend's MAX_LOGBOOK_BYTES (parsed), injected by vite.config.ts `define`. */
declare const __MAX_LOGBOOK_BYTES__: number;
