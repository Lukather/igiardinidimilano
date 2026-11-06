/**
 * Vite's environment variables, declared here rather than pulled from
 * `vite/client`: that file also redefines globals that clash with the Workers
 * types this project compiles against.
 */
interface ImportMetaEnv {
  /** Turnstile site key. Public by design; the secret never reaches the browser. */
  readonly VITE_TURNSTILE_SITEKEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
