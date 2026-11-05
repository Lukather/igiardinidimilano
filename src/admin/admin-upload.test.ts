/**
 * End-to-end test of the admin panel: a real server, a real HTTP upload, and
 * the artefacts it leaves on disk.
 *
 * The server is started as a child process with its directories and port
 * pointed at a temp workspace, so nothing touches the repo.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { findRemainingMetadata } from '../scripts/image-metadata';
import { IMAGE_BUDGET, isWithinBudget } from '../scripts/image-budget';

const ROOT = process.cwd();
const WORK = path.join(ROOT, 'tests', 'temp', 'admin-upload');
const PHOTO_DIR = path.join(WORK, 'photos');
const METADATA_DIR = path.join(WORK, 'data', 'photos');
const DATA_FILE = path.join(WORK, 'data', 'photos.json');
const PORT = 3917;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | null = null;
let serverOutput = '';

/** Start the panel and wait until it is listening. */
async function startServer(env: Record<string, string> = {}): Promise<void> {
  server = spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'src/admin/admin-server.mjs'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ADMIN_HOST: '127.0.0.1',
        ADMIN_PORT: String(PORT),
        ADMIN_PHOTO_DIR: PHOTO_DIR,
        ADMIN_METADATA_DIR: METADATA_DIR,
        ADMIN_DATA_FILE: DATA_FILE,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  serverOutput = '';
  server.stdout?.on('data', (chunk) => (serverOutput += chunk.toString()));
  server.stderr?.on('data', (chunk) => (serverOutput += chunk.toString()));

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverOutput.includes('Admin panel running')) return;
    if (serverOutput.includes('EADDRINUSE')) throw new Error(serverOutput);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`The admin server did not start:\n${serverOutput}`);
}

async function stopServer(): Promise<void> {
  if (!server) return;
  server.kill();
  server = null;
  // Give the port a moment to be released.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** An incompressible JPEG: the only way to get a genuinely large body. */
async function noisyJpeg(width = 1600, height = 1200): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = Math.floor(Math.random() * 256);
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** A JPEG with EXIF, like a camera original. */
async function originalJpeg(width = 1200, height = 900): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 45, g: 95, b: 55 } },
  })
    .withMetadata({ exif: { IFD0: { Make: 'TestCam', DateTime: '2024:04:10 12:00:00' } } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

function uploadForm(photo: Buffer, fields: Record<string, string>): FormData {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'photo.jpg');

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  return form;
}

const VALID_FIELDS = {
  latitude: '45.4642',
  longitude: '9.19',
  date: '2024-04-10',
  category: 'curato',
  space: 'Prova Pannello',
  description: 'Foto caricata dal pannello durante il test',
};

async function upload(photo: Buffer, fields: Record<string, string> = VALID_FIELDS) {
  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: uploadForm(photo, fields),
  });

  return { status: response.status, body: await response.json() };
}

describe('Admin panel upload', () => {
  beforeAll(async () => {
    fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    await startServer();
  }, 60_000);

  afterAll(async () => {
    await stopServer();
    fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe('Publishing a photo', () => {
    it('writes the image and the metadata', async () => {
      const { status, body } = await upload(await originalJpeg());

      expect(status).toBe(200);
      expect(body.success).toBe(true);

      expect(fs.existsSync(path.join(PHOTO_DIR, `${body.photoId}.jpg`))).toBe(true);
      expect(fs.existsSync(path.join(METADATA_DIR, `${body.photoId}.json`))).toBe(true);
    });

    it('publishes an image without metadata', async () => {
      const { body } = await upload(await originalJpeg());

      const published = fs.readFileSync(path.join(PHOTO_DIR, `${body.photoId}.jpg`));

      expect(findRemainingMetadata(published)).toEqual([]);
    });

    it('publishes an image within the size budget', async () => {
      const { body } = await upload(await originalJpeg());

      const bytes = fs.statSync(path.join(PHOTO_DIR, `${body.photoId}.jpg`)).size;

      expect(isWithinBudget(bytes)).toBe(true);
      expect(body.withinBudget).toBe(true);
      expect(body.targetSizeKB).toBe(IMAGE_BUDGET.targetSizeKB);
    });

    it('writes metadata that the build accepts', async () => {
      const { body } = await upload(await originalJpeg());

      const metadata = JSON.parse(
        fs.readFileSync(path.join(METADATA_DIR, `${body.photoId}.json`), 'utf-8'),
      );

      expect(metadata).toMatchObject({
        id: body.photoId,
        category: VALID_FIELDS.category,
        date: VALID_FIELDS.date,
        space: VALID_FIELDS.space,
        description: VALID_FIELDS.description,
        coordinates: { latitude: 45.4642, longitude: 9.19 },
      });
    });

    it('regenerates the site data, so the repo stays coherent', async () => {
      const { body } = await upload(await originalJpeg());

      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

      expect(data.photos.some((photo: { id: string }) => photo.id === body.photoId)).toBe(true);
      expect(body.stats.totalPhotos).toBe(data.photos.length);
    });

    it('allocates a new ID instead of overwriting on a repeated upload', async () => {
      const first = await upload(await originalJpeg());
      const second = await upload(await originalJpeg());

      expect(second.body.photoId).not.toBe(first.body.photoId);
      expect(second.body.index).toBe(first.body.index + 1);
      expect(fs.existsSync(path.join(PHOTO_DIR, `${first.body.photoId}.jpg`))).toBe(true);
    });
  });

  describe('Refusing invalid metadata', () => {
    it('rejects an unknown category, naming the field', async () => {
      const { status, body } = await upload(await originalJpeg(), {
        ...VALID_FIELDS,
        category: 'disastrato',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('category');
    });

    it('rejects coordinates outside Milan, naming the field', async () => {
      const { status, body } = await upload(await originalJpeg(), {
        ...VALID_FIELDS,
        latitude: '41.9',
        longitude: '12.5',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('coordinates.latitude');
    });

    it('rejects a too short description, naming the field', async () => {
      const { status, body } = await upload(await originalJpeg(), {
        ...VALID_FIELDS,
        description: 'corto',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('description');
    });

    it('writes nothing when validation fails', async () => {
      const before = fs.readdirSync(METADATA_DIR).length;

      await upload(await originalJpeg(), { ...VALID_FIELDS, category: 'disastrato' });

      expect(fs.readdirSync(METADATA_DIR).length).toBe(before);
    });
  });

  describe('Upload size limit', () => {
    it('rejects a body declared above the limit without reading it', async () => {
      // Body clearly larger than limit + multipart slack: the pre-check fires.
      await stopServer();
      await startServer({ ADMIN_MAX_UPLOAD_MB: '0.2' });

      const photo = await noisyJpeg();
      expect(photo.length).toBeGreaterThan(1024 * 1024);

      const { status, body } = await upload(photo);

      expect(status).toBe(413);
      expect(body.error).toMatch(/too large/i);
    }, 60_000);

    it('rejects a body that only exceeds the limit while streaming', async () => {
      // Body under limit + slack, so the pre-check lets it through and the
      // streaming limit has to stop it.
      await stopServer();
      await startServer({ ADMIN_MAX_UPLOAD_MB: '1' });

      const photo = await noisyJpeg();
      expect(photo.length).toBeGreaterThan(1024 * 1024);
      expect(photo.length).toBeLessThan(2 * 1024 * 1024);

      const { status, body } = await upload(photo);

      expect(status).toBe(413);
      expect(body.error).toMatch(/too large/i);
    }, 60_000);

    it('writes nothing when the upload is refused', async () => {
      const before = fs.readdirSync(PHOTO_DIR).length;

      await upload(await noisyJpeg());

      expect(fs.readdirSync(PHOTO_DIR).length).toBe(before);
    }, 60_000);

    it('keeps serving after a rejected upload', async () => {
      const response = await fetch(`${BASE_URL}/admin`);

      expect(response.status).toBe(200);
    });
  });
});
