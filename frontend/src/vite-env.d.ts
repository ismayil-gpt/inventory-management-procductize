/// <reference types="vite/client" />

// Optional hosting override. When UNSET (local development), the app uses the
// relative "/api/v1" path served through the Vite dev proxy — local workflow is
// unchanged. Set it only for a hosted build where the API lives on another origin.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
