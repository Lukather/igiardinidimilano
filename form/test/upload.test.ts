/**
 * The upload seam: one HTTP request in, objects in a real R2 bucket out.
 *
 * The bucket is a real R2 implementation (Miniflare, the same engine wrangler
 * uses locally), not a mock: a mock would only prove the mock works. Nothing
 * here inspects the handler's internals — every assertion is on the response
 * or on what ended up in storage.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Miniflare } from 'miniflare';
import sharp from 'sharp';
import { handleUpload, MAX_UPLOAD_BYTES, type Deps, type Env } from '../src/upload-handler';
import { photoSchema } from '../../src/types/schemas';
import { MILAN_BOUNDS, LIMITS } from '../src/submission';

const ENDPOINT = 'https://form.test/api/upload';

let miniflare: Miniflare;
let bucket: R2Bucket;

const VALID_FIELDS: Record<string, string> = {
  category: 'curato',
  latitude: '45.4642',
  longitude: '9.19',
  date: '2026-11-05',
  space: 'Parco Sempione',
  description: 'Prato tagliato e panchine integre, nessun rifiuto',
};

/** A small JPEG carrying EXIF, like a phone original. */
async function jpegWithExif(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 90, b: 50 } },
  })
    .withMetadata({ exif: { IFD0: { Make: 'TestPhone', DateTime: '2026:11:05 10:00:00' } } })
    .jpeg({ quality: 80 })
    .toBuffer();

  return new Uint8Array(buffer);
}

// Module-level so successive calls get distinct suffixes, like the real random
// one: a per-call counter would make every submission share an id.
let suffixCounter = 0;

function deps(overrides: Partial<Deps> = {}): Deps {
  return {
    verifyTurnstile: async () => true,
    now: () => new Date('2026-11-06T10:30:00.000Z'),
    randomSuffix: () => `00000000000000${(suffixCounter++).toString(16).padStart(2, '0')}`,
    ...overrides,
  };
}

function uploadRequest(options: {
  fields?: Record<string, string>;
  photo?: Uint8Array | null;
  photoType?: string;
  photoName?: string;
  turnstile?: string | null;
  method?: string;
} = {}): Request {
  const {
    fields = VALID_FIELDS,
    photo,
    photoType = 'image/jpeg',
    photoName = 'foto.jpg',
    turnstile = 'test-token',
    method = 'POST',
  } = options;

  const form = new FormData();
  if (turnstile !== null) {
    form.append('cf-turnstile-response', turnstile);
  }
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  if (photo !== null) {
    const bytes = photo ?? new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    form.append('photo', new File([bytes], photoName, { type: photoType }));
  }

  return new Request(ENDPOINT, { method, body: method === 'POST' ? form : undefined });
}

async function call(request: Request, overrides: Partial<Deps> = {}) {
  const env = { PENDING: bucket, TURNSTILE_SECRET: 'test-secret' } as Env;
  const response = await handleUpload(request, env, deps(overrides));

  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function storedKeys(): Promise<string[]> {
  const list = await bucket.list({ prefix: 'pending/' });
  return list.objects.map((object) => object.key).sort();
}

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    r2Buckets: ['PENDING'],
  });
  bucket = (await miniflare.getR2Bucket('PENDING')) as unknown as R2Bucket;
});

afterAll(async () => {
  await miniflare.dispose();
});

beforeEach(async () => {
  for (const key of await storedKeys()) {
    await bucket.delete(key);
  }
});

describe('A valid submission', () => {
  it('stores the original and its metadata under a new prefix', async () => {
    const { status, body } = await call(uploadRequest({ photo: await jpegWithExif() }));

    expect(status).toBe(201);
    expect(typeof body.id).toBe('string');

    expect(await storedKeys()).toEqual([
      `pending/${body.id}/original.jpg`,
      `pending/${body.id}/submission.json`,
    ]);
  });

  it('keeps the original byte for byte, EXIF included', async () => {
    const original = await jpegWithExif();
    const { body } = await call(uploadRequest({ photo: original }));

    const stored = await bucket.get(`pending/${body.id}/original.jpg`);
    const bytes = new Uint8Array(await stored!.arrayBuffer());

    // The strip happens at publication, not here: the ingest needs the GPS.
    expect(bytes).toEqual(original);
    expect(Buffer.from(bytes).includes(Buffer.from('Exif'))).toBe(true);
  });

  it('writes the fields the form sent', async () => {
    const { body } = await call(uploadRequest({ photo: await jpegWithExif() }));

    const stored = await bucket.get(`pending/${body.id}/submission.json`);
    const submission = JSON.parse(await stored!.text());

    expect(submission).toMatchObject({
      id: body.id,
      categoryProposed: 'curato',
      coordinates: { latitude: 45.4642, longitude: 9.19 },
      date: '2026-11-05',
      space: 'Parco Sempione',
      description: VALID_FIELDS.description,
      originalType: 'image/jpeg',
    });
    expect(submission.receivedAt).toBe('2026-11-06T10:30:00.000Z');
    expect(submission.originalBytes).toBeGreaterThan(0);
  });

  it('omits the author when the field is left blank', async () => {
    const { body } = await call(
      uploadRequest({ photo: await jpegWithExif(), fields: { ...VALID_FIELDS, author: '   ' } }),
    );

    const stored = await bucket.get(`pending/${body.id}/submission.json`);
    const raw = await stored!.text();

    expect(JSON.parse(raw).author).toBeUndefined();
    expect(raw).not.toContain('author');
  });

  it('keeps the author when one is given', async () => {
    const { body } = await call(
      uploadRequest({ photo: await jpegWithExif(), fields: { ...VALID_FIELDS, author: 'Lorenzo' } }),
    );

    const stored = await bucket.get(`pending/${body.id}/submission.json`);

    expect(JSON.parse(await stored!.text()).author).toBe('Lorenzo');
  });

  it('never lets two submissions share a prefix', async () => {
    const first = await call(uploadRequest({ photo: await jpegWithExif() }));
    const second = await call(uploadRequest({ photo: await jpegWithExif() }));

    expect(second.body.id).not.toBe(first.body.id);
    expect(await storedKeys()).toHaveLength(4);
  });
});

describe('The original is stored as the type it really is', () => {
  it('ignores the declared type and the filename', async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);

    const { body } = await call(
      uploadRequest({ photo: png, photoType: 'image/jpeg', photoName: 'foto.jpg' }),
    );

    expect(await storedKeys()).toContain(`pending/${body.id}/original.png`);
  });
});

describe('Refusing what must not be stored', () => {
  it('rejects a file over 15 MB with 413 and writes nothing', async () => {
    const tooBig = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    tooBig.set([0xff, 0xd8, 0xff]);

    const { status } = await call(uploadRequest({ photo: tooBig }));

    expect(status).toBe(413);
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects a non-image that claims to be a JPEG', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

    const { status, body } = await call(
      uploadRequest({ photo: zip, photoType: 'image/jpeg', photoName: 'foto.jpg' }),
    );

    expect(status).toBe(415);
    expect(body.field).toBe('photo');
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects a submission without a Turnstile token', async () => {
    const { status } = await call(uploadRequest({ photo: await jpegWithExif(), turnstile: null }), {
      verifyTurnstile: async () => false,
    });

    expect(status).toBe(403);
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects a submission whose challenge did not pass', async () => {
    const { status } = await call(uploadRequest({ photo: await jpegWithExif() }), {
      verifyTurnstile: async () => false,
    });

    expect(status).toBe(403);
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects a method other than POST', async () => {
    const { status } = await call(uploadRequest({ method: 'GET' }));

    expect(status).toBe(405);
  });

  it('rejects a body that is not multipart', async () => {
    const request = new Request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    const { status } = await call(request);

    expect(status).toBe(415);
  });

  it('rejects a missing photo', async () => {
    const { status, body } = await call(uploadRequest({ photo: null }));

    expect(status).toBe(400);
    expect(body.field).toBe('photo');
  });

  it('names the field when the category is not one of the two', async () => {
    const { status, body } = await call(
      uploadRequest({ photo: await jpegWithExif(), fields: { ...VALID_FIELDS, category: 'disastrato' } }),
    );

    expect(status).toBe(400);
    expect(body.field).toBe('category');
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects coordinates outside Milan, naming the field', async () => {
    const { status, body } = await call(
      uploadRequest({
        photo: await jpegWithExif(),
        fields: { ...VALID_FIELDS, latitude: '41.9', longitude: '12.5' },
      }),
    );

    expect(status).toBe(400);
    expect(body.field).toBe('coordinates');
  });

  it('rejects a description that is too short', async () => {
    const { status, body } = await call(
      uploadRequest({ photo: await jpegWithExif(), fields: { ...VALID_FIELDS, description: 'corto' } }),
    );

    expect(status).toBe(400);
    expect(body.field).toBe('description');
  });
});

describe('The form and the published schema stay in agreement', () => {
  const validPhoto = {
    id: '2026-11-05-parco-sempione-01',
    category: 'curato',
    coordinates: { latitude: 45.4642, longitude: 9.19 },
    date: '2026-11-05',
    description: 'Prato tagliato e panchine integre',
    space: 'Parco Sempione',
    imageFile: '2026-11-05-parco-sempione-01.jpg',
  };

  it('uses the same Milan bounds', () => {
    expect(MILAN_BOUNDS).toEqual({
      minLatitude: 45.35,
      maxLatitude: 45.55,
      minLongitude: 8.95,
      maxLongitude: 9.3,
    });
  });

  it('uses the same description limits', () => {
    const at = (length: number) => ({ ...validPhoto, description: 'a'.repeat(length) });

    expect(photoSchema.safeParse(at(LIMITS.descriptionMin - 1)).success).toBe(false);
    expect(photoSchema.safeParse(at(LIMITS.descriptionMin)).success).toBe(true);
    expect(photoSchema.safeParse(at(LIMITS.descriptionMax)).success).toBe(true);
    expect(photoSchema.safeParse(at(LIMITS.descriptionMax + 1)).success).toBe(false);
  });

  it('uses the same space and author limits', () => {
    expect(photoSchema.safeParse({ ...validPhoto, space: 'a'.repeat(LIMITS.spaceMax) }).success).toBe(true);
    expect(photoSchema.safeParse({ ...validPhoto, space: 'a'.repeat(LIMITS.spaceMax + 1) }).success).toBe(false);

    expect(photoSchema.safeParse({ ...validPhoto, author: 'a'.repeat(LIMITS.authorMax) }).success).toBe(true);
    expect(photoSchema.safeParse({ ...validPhoto, author: 'a'.repeat(LIMITS.authorMax + 1) }).success).toBe(false);
  });
});
