/**
 * Which Turnstile site key the form is built with.
 *
 * The key is public, so it is baked into the bundle at build time. The subtle
 * part is the fallback: an unset variable and an *empty* one are different
 * things to JavaScript but the same thing to us, and a bundle with an empty
 * sitekey renders no widget at all — a form that silently cannot be submitted.
 *
 * So an empty value falls back to the test key, which the deploy workflow then
 * refuses to publish. Failing loudly at deploy beats failing quietly in the
 * browser.
 */

/** Cloudflare's always-passes site key. Never valid in production. */
export const TEST_SITEKEY = '1x00000000000000000000AA';

export function resolveSitekey(value: string | undefined): string {
  const trimmed = value?.trim();

  return trimmed ? trimmed : TEST_SITEKEY;
}
