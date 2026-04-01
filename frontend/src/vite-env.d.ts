/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_HEALTH_URL?: string;
  readonly VITE_DEV_HMR_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
