import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { build, sortPhotos, type BuildConfig } from './build';
import type { Photo, SiteData } from '../types/types';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'build-output');
const METADATA_DIR = path.join(TEST_DIR, 'photos');
const PHOTO_DIR = path.join(TEST_DIR, 'images');
const OUTPUT_FILE = path.join(TEST_DIR, 'photos.json');

const CONFIG: BuildConfig = {
  metadataDir: METADATA_DIR,
  photoDir: PHOTO_DIR,
  outputFile: OUTPUT_FILE,
};

function photo(overrides: Partial<Photo> & Pick<Photo, 'id' | 'date'>): Photo {
  return {
    category: 'curato',
    coordinates: { latitude: 45.4642, longitude: 9.19 },
    description: 'Foto di prova con descrizione valida',
    space: 'Parco Sempione',
    imageFile: `${overrides.id}.jpg`,
    ...overrides,
  };
}

/** Publish a photo the way the ingest does: metadata file plus image. */
function publish(p: Photo): void {
  fs.writeFileSync(path.join(METADATA_DIR, `${p.id}.json`), JSON.stringify(p, null, 2));
  fs.writeFileSync(path.join(PHOTO_DIR, p.imageFile), 'fake image data');
}

function readOutput(): SiteData {
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')) as SiteData;
}

/** Silence the build's progress logging while keeping failures visible. */
async function buildQuietly(): Promise<void> {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try {
    await build(CONFIG);
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe('Build output', () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe('Reproducibility', () => {
    it('produces a byte-identical file on consecutive builds', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));
      publish(photo({ id: '2024-02-20-parco-vecchio-01', date: '2024-02-20' }));

      await buildQuietly();
      const first = fs.readFileSync(OUTPUT_FILE);

      await buildQuietly();
      const second = fs.readFileSync(OUTPUT_FILE);

      expect(second.equals(first)).toBe(true);
    });

    it('does not depend on the order the metadata files were written', async () => {
      const photos = [
        photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }),
        photo({ id: '2024-02-20-parco-vecchio-01', date: '2024-02-20' }),
        photo({ id: '2024-03-01-giardini-indro-01', date: '2024-03-01' }),
      ];

      for (const p of photos) publish(p);
      await buildQuietly();
      const forward = fs.readFileSync(OUTPUT_FILE);

      // Rewrite the metadata in reverse order, then build again.
      for (const p of photos) fs.rmSync(path.join(METADATA_DIR, `${p.id}.json`));
      for (const p of [...photos].reverse()) {
        fs.writeFileSync(path.join(METADATA_DIR, `${p.id}.json`), JSON.stringify(p, null, 2));
      }
      await buildQuietly();
      const reversed = fs.readFileSync(OUTPUT_FILE);

      expect(reversed.equals(forward)).toBe(true);
    });

    it('carries no build timestamp', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));

      await buildQuietly();
      const output = readOutput();

      expect(output).not.toHaveProperty('lastUpdated');
      expect(JSON.stringify(output)).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Ordering', () => {
    it('sorts photos newest first', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));
      publish(photo({ id: '2024-03-01-giardini-indro-01', date: '2024-03-01' }));
      publish(photo({ id: '2024-02-20-parco-vecchio-01', date: '2024-02-20' }));

      await buildQuietly();

      expect(readOutput().photos.map((p) => p.date)).toEqual([
        '2024-03-01',
        '2024-02-20',
        '2024-01-15',
      ]);
    });

    it('breaks ties on the same date by ID ascending', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-02', date: '2024-01-15' }));
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));

      await buildQuietly();

      expect(readOutput().photos.map((p) => p.id)).toEqual([
        '2024-01-15-parco-sempione-01',
        '2024-01-15-parco-sempione-02',
      ]);
    });

    it('leaves the input array untouched', () => {
      const input = [
        photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }),
        photo({ id: '2024-02-20-parco-vecchio-01', date: '2024-02-20' }),
      ];
      const snapshot = input.map((p) => p.id);

      sortPhotos(input);

      expect(input.map((p) => p.id)).toEqual(snapshot);
    });

    it('keeps the hero selection stable', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15', category: 'curato' }));
      publish(photo({ id: '2024-02-20-parco-vecchio-01', date: '2024-02-20', category: 'in degrado' }));

      await buildQuietly();
      const first = readOutput();

      await buildQuietly();
      const second = readOutput();

      // The hero takes the first photo of each category.
      expect(first.photos.find((p) => p.category === 'curato')?.id).toBe(
        second.photos.find((p) => p.category === 'curato')?.id,
      );
      expect(first.photos.find((p) => p.category === 'in degrado')?.id).toBe(
        second.photos.find((p) => p.category === 'in degrado')?.id,
      );
    });
  });

  describe('latestPhotoDate', () => {
    it('is the date of the most recent photo', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));
      publish(photo({ id: '2024-03-01-giardini-indro-01', date: '2024-03-01' }));

      await buildQuietly();

      expect(readOutput().latestPhotoDate).toBe('2024-03-01');
    });

    it('matches the first photo of the sorted list', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));

      await buildQuietly();
      const output = readOutput();

      expect(output.latestPhotoDate).toBe(output.photos[0].date);
    });
  });

  describe('Validation failures', () => {
    it('throws instead of terminating the process on an invalid category', async () => {
      publish(photo({ id: '2024-01-15-parco-sempione-01', date: '2024-01-15' }));
      fs.writeFileSync(
        path.join(METADATA_DIR, '2024-01-16-broken-01.json'),
        JSON.stringify({
          id: '2024-01-16-broken-01',
          category: 'disastrato',
          coordinates: { latitude: 45.4642, longitude: 9.19 },
          date: '2024-01-16',
          description: 'Categoria inesistente di proposito',
          space: 'Parco Rotto',
          imageFile: '2024-01-16-broken-01.jpg',
        }),
      );

      await expect(buildQuietly()).rejects.toThrow(/1 photo\(s\) failed validation/);
    });

    it('writes nothing when validation fails', async () => {
      fs.writeFileSync(
        path.join(METADATA_DIR, '2024-01-16-broken-01.json'),
        JSON.stringify({ id: '2024-01-16-broken-01' }),
      );

      await expect(buildQuietly()).rejects.toThrow();
      expect(fs.existsSync(OUTPUT_FILE)).toBe(false);
    });
  });
});
