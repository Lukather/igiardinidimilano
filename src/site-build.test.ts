/**
 * End-to-end tests over the whole publishing seam.
 *
 * Fixtures in (metadata files + real JPEGs carrying EXIF), built site out
 * (`photos.json`, the images copied into the output, the landing HTML). Every
 * assertion looks at an artefact, never at the internals of the scripts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { build as viteBuild } from 'vite';
import { build, type BuildConfig } from './scripts/build';
import { emitSiteAssets } from './scripts/emit-site-assets';
import { findRemainingMetadata } from './scripts/image-metadata';
import { optimizeImage } from './scripts/optimize-image';
import { IMAGE_BUDGET, isWithinBudget } from './scripts/image-budget';
import type { SiteData } from './types/types';

const ROOT = process.cwd();
const WORK = path.join(ROOT, 'tests', 'temp', 'site-build');
const METADATA_DIR = path.join(WORK, 'data', 'photos');
const PHOTO_DIR = path.join(WORK, 'photos');
const DATA_FILE = path.join(WORK, 'data', 'photos.json');
const OUT_DIR = path.join(WORK, 'dist');
const ORIGINALS_DIR = path.join(WORK, 'originals');

const CONFIG: BuildConfig = {
  metadataDir: METADATA_DIR,
  photoDir: PHOTO_DIR,
  outputFile: DATA_FILE,
};

/** Fixture photos: one per category, with the coordinates confirmed by hand. */
const FIXTURES = [
  {
    id: '2024-03-10-giardino-curato-01',
    category: 'curato',
    coordinates: { latitude: 45.48, longitude: 9.19 },
    date: '2024-03-10',
    description: 'Giardino curato con prato tagliato e panchine integre',
    space: 'Giardino Curato',
    imageFile: '2024-03-10-giardino-curato-01.jpg',
  },
  {
    id: '2024-03-12-area-degradata-01',
    category: 'in degrado',
    coordinates: { latitude: 45.45, longitude: 9.21 },
    date: '2024-03-12',
    description: 'Area in degrado con rifiuti abbandonati e staccionata rotta',
    space: 'Area Degradata',
    imageFile: '2024-03-12-area-degradata-01.jpg',
  },
] as const;

/**
 * A JPEG carrying EXIF and an ICC profile, like a camera original.
 *
 * Textured rather than flat: a solid colour compresses so well that the
 * published file would be below the placeholder threshold and the gate would
 * reject it for the wrong reason.
 */
async function writeOriginalPhoto(file: string): Promise<void> {
  const width = 1200;
  const height = 900;
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = Math.floor(Math.random() * 256);
  }

  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .blur(2)
    .withMetadata({
      exif: {
        IFD0: {
          Make: 'TestCam',
          Model: 'Fixture',
          DateTime: '2024:03:10 09:15:00',
        },
      },
    })
    .jpeg({ quality: 90 })
    .toFile(file);
}

/**
 * Run an original through the same pipeline the ingest uses, producing the
 * stripped image that actually lands in the photo directory.
 */
async function publishPhoto(original: string, published: string): Promise<void> {
  await optimizeImage(original, published);
}

function writeMetadata(metadata: unknown, fileName: string): void {
  fs.writeFileSync(path.join(METADATA_DIR, fileName), JSON.stringify(metadata, null, 2));
}

function readSiteData(): SiteData {
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'data', 'photos.json'), 'utf-8'));
}

function readLanding(): string {
  return fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf-8');
}

/** Run the data build with the console silenced. */
async function buildQuietly(config: BuildConfig = CONFIG): Promise<void> {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try {
    await build(config);
  } finally {
    console.log = log;
    console.error = error;
  }
}

/**
 * Build a throwaway project containing a single broken metadata file and
 * return the error the pipeline produced.
 */
async function buildWithBrokenPhoto(
  name: string,
  metadata: unknown,
  withImage = true,
): Promise<Error> {
  const dir = path.join(WORK, 'broken', name);
  const metadataDir = path.join(dir, 'data', 'photos');
  const photoDir = path.join(dir, 'photos');
  fs.mkdirSync(metadataDir, { recursive: true });
  fs.mkdirSync(photoDir, { recursive: true });

  fs.writeFileSync(path.join(metadataDir, `${name}.json`), JSON.stringify(metadata, null, 2));
  if (withImage) {
    fs.writeFileSync(path.join(photoDir, `${name}.jpg`), 'fake image data');
  }

  try {
    await buildQuietly({
      metadataDir,
      photoDir,
      outputFile: path.join(dir, 'photos.json'),
    });
  } catch (error) {
    return error as Error;
  }

  throw new Error('The pipeline was expected to fail but it did not');
}

describe('Publishing the site', () => {
  beforeAll(async () => {
    fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    fs.mkdirSync(ORIGINALS_DIR, { recursive: true });

    for (const fixture of FIXTURES) {
      const original = path.join(ORIGINALS_DIR, fixture.imageFile);
      await writeOriginalPhoto(original);
      await publishPhoto(original, path.join(PHOTO_DIR, fixture.imageFile));
      writeMetadata(fixture, `${fixture.id}.json`);
    }

    // 1. data build
    await buildQuietly();

    // 2. site build, into the fixture output directory
    await viteBuild({
      root: path.join(ROOT, 'src'),
      logLevel: 'silent',
      build: { outDir: OUT_DIR, emptyOutDir: true },
    });

    // 3. publish data and images next to the bundle
    await emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });
  }, 120_000);

  afterAll(() => {
    fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe('The output is complete', () => {
    it('contains the landing page, the bundle, the data and the photos', () => {
      expect(fs.existsSync(path.join(OUT_DIR, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(OUT_DIR, 'data', 'photos.json'))).toBe(true);

      const assets = fs.readdirSync(path.join(OUT_DIR, 'assets'));
      expect(assets.some((file) => file.endsWith('.js'))).toBe(true);
      expect(assets.some((file) => file.endsWith('.css'))).toBe(true);

      const published = fs.readdirSync(path.join(OUT_DIR, 'photos')).sort();
      expect(published).toEqual(FIXTURES.map((f) => f.imageFile).sort());
    });

    it('references no file that is missing from the output', () => {
      const landing = readLanding();
      // The build emits relative URLs (`./assets/…`) so the site also works
      // under a sub-path; resolve them against the output root either way.
      const referenced = [...landing.matchAll(/(?:src|href)="(\.?\/[^"]+)"/g)].map((m) =>
        m[1].replace(/^\.\//, ''),
      );

      expect(referenced.length).toBeGreaterThan(0);

      for (const ref of referenced) {
        expect(fs.existsSync(path.join(OUT_DIR, ref))).toBe(true);
      }
    });
  });

  describe('Published images carry no metadata', () => {
    it('strips EXIF, GPS and ICC from every published photo', () => {
      const published = fs.readdirSync(path.join(OUT_DIR, 'photos'));

      for (const file of published) {
        const buffer = fs.readFileSync(path.join(OUT_DIR, 'photos', file));
        expect({ file, metadata: findRemainingMetadata(buffer) }).toEqual({
          file,
          metadata: [],
        });
      }
    });

    it('is a real check: the camera originals do carry metadata', () => {
      const original = fs.readFileSync(path.join(ORIGINALS_DIR, FIXTURES[0].imageFile));

      expect(findRemainingMetadata(original)).toContain('exif');
    });

    it('refuses to publish an image that was never stripped', async () => {
      const dirtyDir = path.join(WORK, 'dirty');
      const dirtyPhotos = path.join(dirtyDir, 'photos');
      fs.mkdirSync(dirtyPhotos, { recursive: true });
      // Both referenced images must exist, otherwise the missing-file check
      // fires first and this test would pass for the wrong reason.
      for (const fixture of FIXTURES) {
        fs.copyFileSync(
          path.join(ORIGINALS_DIR, fixture.imageFile),
          path.join(dirtyPhotos, fixture.imageFile),
        );
      }

      await expect(
        emitSiteAssets({
          dataFile: DATA_FILE,
          photoDir: dirtyPhotos,
          outDir: path.join(dirtyDir, 'dist'),
        }),
      ).rejects.toThrow(/cannot be published[\s\S]*exif/);
    });
  });

  describe('Published images respect the size budget', () => {
    it('keeps every published photo within the budget', () => {
      const published = fs.readdirSync(path.join(OUT_DIR, 'photos'));

      for (const file of published) {
        const bytes = fs.statSync(path.join(OUT_DIR, 'photos', file)).size;
        expect({ file, withinBudget: isWithinBudget(bytes) }).toEqual({
          file,
          withinBudget: true,
        });
      }
    });

    it('reports the budget it applied', () => {
      expect(IMAGE_BUDGET.targetSizeKB).toBe(300);
    });
  });

  describe('The generated data', () => {
    it('contains the expected photos', () => {
      const data = readSiteData();

      expect(data.photos.map((photo) => photo.id).sort()).toEqual(
        FIXTURES.map((f) => f.id).sort(),
      );
    });

    it('carries the confirmed coordinates', () => {
      const data = readSiteData();

      for (const fixture of FIXTURES) {
        const photo = data.photos.find((p) => p.id === fixture.id);

        expect(photo?.coordinates).toEqual(fixture.coordinates);
        expect(photo?.date).toBe(fixture.date);
        expect(photo?.category).toBe(fixture.category);
        expect(photo?.space).toBe(fixture.space);
      }
    });

    it('counts what the fixtures contain', () => {
      const data = readSiteData();

      expect(data.stats).toEqual({
        totalPhotos: 2,
        curatedSpaces: 1,
        degradedSpaces: 1,
      });
    });

    it('reports the most recent photo date', () => {
      expect(readSiteData().latestPhotoDate).toBe('2024-03-12');
    });
  });

  describe('The landing page', () => {
    it('is in Italian', () => {
      expect(readLanding()).toContain('<html lang="it">');
    });

    it('has the split hero, one half per category', () => {
      const landing = readLanding();

      expect(landing).toContain('hero-split');
      expect(landing).toContain('hero-half--curato');
      expect(landing).toContain('hero-half--degraded');
      expect(landing).toContain('id="hero-curato-img"');
      expect(landing).toContain('id="hero-degraded-img"');
    });

    it('has the three counters the data fills in', () => {
      const landing = readLanding();

      expect(landing).toContain('id="stat-total"');
      expect(landing).toContain('id="stat-curato"');
      expect(landing).toContain('id="stat-degraded"');
    });

    it('declares the CC BY-SA 4.0 licence with a link', () => {
      const landing = readLanding();

      expect(landing).toContain('CC BY-SA 4.0');
      expect(landing).toContain('creativecommons.org/licenses/by-sa/4.0');
    });

    it('states the purpose of the site in the footer', () => {
      expect(readLanding()).toContain('footer-purpose');
    });

    it('loads no script or stylesheet from an external host', () => {
      const landing = readLanding();
      const externalScripts = landing.match(/<script[^>]+src="https?:\/\/[^"]+"/g) ?? [];
      const externalStyles = landing.match(/<link[^>]+href="https?:\/\/[^"]+"/g) ?? [];

      expect([...externalScripts, ...externalStyles]).toEqual([]);
    });
  });

  describe('Validation failures', () => {
    const valid = {
      id: '2024-03-10-giardino-curato-01',
      category: 'curato',
      coordinates: { latitude: 45.48, longitude: 9.19 },
      date: '2024-03-10',
      description: 'Descrizione valida di prova per la validazione',
      space: 'Giardino Curato',
      imageFile: '2024-03-10-giardino-curato-01.jpg',
    };

    it('fails on an unknown category, naming the file and the field', async () => {
      const error = await buildWithBrokenPhoto('2024-03-10-broken-01', {
        ...valid,
        id: '2024-03-10-broken-01',
        category: 'disastrato',
      });

      expect(error.message).toContain('2024-03-10-broken-01.json');
      expect(error.message).toContain('category');
    });

    it('fails on missing coordinates, naming the file and the field', async () => {
      const { coordinates, ...withoutCoordinates } = valid;
      const error = await buildWithBrokenPhoto('2024-03-10-broken-02', {
        ...withoutCoordinates,
        id: '2024-03-10-broken-02',
      });

      expect(error.message).toContain('2024-03-10-broken-02.json');
      expect(error.message).toContain('coordinates');
    });

    it('fails on a missing date, naming the file and the field', async () => {
      const { date, ...withoutDate } = valid;
      const error = await buildWithBrokenPhoto('2024-03-10-broken-03', {
        ...withoutDate,
        id: '2024-03-10-broken-03',
      });

      expect(error.message).toContain('2024-03-10-broken-03.json');
      expect(error.message).toContain('date');
    });

    it('fails when the referenced image does not exist, naming the file', async () => {
      const error = await buildWithBrokenPhoto(
        '2024-03-10-broken-04',
        { ...valid, id: '2024-03-10-broken-04' },
        false,
      );

      expect(error.message).toContain('2024-03-10-broken-04.json');
      expect(error.message).toContain('2024-03-10-giardino-curato-01.jpg');
    });

    it('writes no data file when a photo is invalid', async () => {
      await buildWithBrokenPhoto('2024-03-10-broken-05', {
        ...valid,
        id: '2024-03-10-broken-05',
        category: 'disastrato',
      });

      expect(fs.existsSync(path.join(WORK, 'broken', '2024-03-10-broken-05', 'photos.json'))).toBe(
        false,
      );
    });
  });
});
