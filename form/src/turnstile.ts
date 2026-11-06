/**
 * Turnstile verification.
 *
 * The public form is anonymous, so this is the only thing standing between the
 * endpoint and a script that fills the staging bucket. It is checked before
 * anything is written: a failed challenge must not leave an object behind.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileVerifier = (
  token: string,
  secret: string,
  remoteIp: string | null,
) => Promise<boolean>;

/**
 * Ask Cloudflare whether the token the form sent is genuine.
 *
 * Any failure — missing token, network error, non-200, malformed body — is a
 * rejection. Failing open would make the check decorative.
 */
export const verifyTurnstile: TurnstileVerifier = async (token, secret, remoteIp) => {
  if (!token || !secret) {
    return false;
  }

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) {
    body.append('remoteip', remoteIp);
  }

  try {
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
};
