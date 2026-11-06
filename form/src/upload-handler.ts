/**
 * The upload endpoint: one request in, staging objects out.
 *
 * Everything the form sends is untrusted. The order of the checks matters:
 * the cheapest rejections come first, and nothing is written to R2 until every
 * check has passed, so a refused submission never leaves a partial object.
 *
 * This module has no Pages-specific imports: the Pages Function is a thin
 * adapter, and the tests call this function directly against a real R2 bucket.
 */

import { detectImageType, extensionFor } from './image-type';
import {
  buildSubmission,
  newSubmissionId,
  randomSuffix,
  readSubmissionFields,
} from './submission';
import { verifyTurnstile, type TurnstileVerifier } from './turnstile';

/** 15 MB. The platform allows 100 MB, but a phone photo is never this big. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Multipart overhead: boundaries, the other fields, the headers. Used only to
 * reject an oversized body before it is buffered; the exact check happens on
 * the file itself.
 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export interface Env {
  PENDING: R2Bucket;
  TURNSTILE_SECRET: string;
}

export interface Deps {
  verifyTurnstile: TurnstileVerifier;
  now: () => Date;
  randomSuffix: () => string;
}

const DEFAULT_DEPS: Deps = {
  verifyTurnstile,
  now: () => new Date(),
  randomSuffix,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function handleUpload(
  request: Request,
  env: Env,
  deps: Deps = DEFAULT_DEPS,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'Metodo non consentito' });
  }

  // Reject an oversized body before buffering it in memory.
  const declaredLength = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return json(413, { error: 'Il file supera il limite di 15 MB' });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return json(415, { error: 'Atteso un invio multipart/form-data' });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'Invio non leggibile' });
  }

  // Anti-bot first: a failed challenge must not reach the storage.
  const token = form.get('cf-turnstile-response');
  const remoteIp = request.headers.get('cf-connecting-ip');
  const human = await deps.verifyTurnstile(
    typeof token === 'string' ? token : '',
    env.TURNSTILE_SECRET,
    remoteIp,
  );
  if (!human) {
    return json(403, { error: 'Verifica anti-bot non riuscita. Ricarica la pagina e riprova.' });
  }

  const file = form.get('photo');
  if (!(file instanceof File)) {
    return json(400, { error: 'La foto è obbligatoria', field: 'photo' });
  }
  if (file.size === 0) {
    return json(400, { error: 'Il file è vuoto', field: 'photo' });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json(413, { error: 'Il file supera il limite di 15 MB', field: 'photo' });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // The declared type and the filename are ignored on purpose.
  const type = detectImageType(bytes);
  if (!type) {
    return json(415, {
      error: 'Formato non supportato: servono JPEG, PNG o WebP',
      field: 'photo',
    });
  }

  const parsed = readSubmissionFields(form);
  if (!parsed.ok) {
    return json(400, { error: parsed.error, field: parsed.field });
  }

  const now = deps.now();
  const id = newSubmissionId(now, deps.randomSuffix);
  const submission = buildSubmission({
    id,
    receivedAt: now.toISOString(),
    fields: parsed.fields,
    originalBytes: bytes.byteLength,
    originalType: type,
  });

  const prefix = `pending/${id}`;

  // The original keeps its EXIF: the ingest needs the GPS to propose the
  // coordinates, and stripping happens at publication, where it always has.
  await env.PENDING.put(`${prefix}/original.${extensionFor(type)}`, bytes, {
    httpMetadata: { contentType: type },
  });
  await env.PENDING.put(`${prefix}/submission.json`, JSON.stringify(submission, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  return json(201, { id });
}
