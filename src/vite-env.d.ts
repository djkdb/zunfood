/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly VITE_API_BASE?: string;
  readonly VITE_PLACES_PROVIDER?: string;
  readonly VITE_AI_JUDGE_PROVIDER?: string;
  readonly VITE_AI_JUDGE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
