import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { emitSiteAssets } from './emit-site-assets';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'emit-site-assets');
const DATA_DIR = path.join(TEST_DIR, 'data');
const PHOTO_DIR = path.join(TEST_DIR, 'photos');
const OUT_DIR = path.join(TEST_DIR, 'dist');

const DATA_FILE = path.join(DATA_DIR, 'photos.json');

function writeData(photos: Array<{ id: string; imageFile: string }>): void {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ photos, stats: {}, lastUpdated: '2024-01-15T00:00:00.000Z' }, null, 2),
  );
}

/** A real, metadata-free JPEG: the publishing gate inspects the bytes. */
let cleanImage: Buffer;

/** A JPEG carrying EXIF, as an unprocessed original would. */
let imageWithExif: Buffer;

function writeImage(imageFile: string, content: Buffer = cleanImage): void {
  fs.writeFileSync(path.join(PHOTO_DIR, imageFile), content);
}

function readData(): { photos: Array<{ id: string; imageFile: string }> } {
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'data', 'photos.json'), 'utf-8'));
}

describe('emitSiteAssets', () => {
  beforeAll(async () => {
    cleanImage = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 20, g: 60, b: 20 } },
    })
      .jpeg()
      .toBuffer();

    imageWithExif = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 20, g: 60, b: 20 } },
    })
      .withMetadata({ exif: { IFD0: { Make: 'TestCam', DateTime: '2024:01:15 10:00:00' } } })
      .jpeg()
      .toBuffer();
  });

  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Publishing the site assets', () => {
    it('copies the aggregated data into the output', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'a.jpg' }]);
      writeImage('a.jpg');

      emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(fs.existsSync(path.join(OUT_DIR, 'data', 'photos.json'))).toBe(true);
      expect(readData().photos).toHaveLength(1);
    });

    it('copies every image referenced by the data', () => {
      writeData([
        { id: '2024-01-15-parco-sempione-01', imageFile: 'a.jpg' },
        { id: '2024-01-16-parco-vecchio-01', imageFile: 'b.jpg' },
      ]);
      writeImage('a.jpg');
      writeImage('b.jpg');

      const result = emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'a.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'b.jpg'))).toBe(true);
      expect(result).toMatchObject({ photos: 2, images: 2 });
    });

    it('does not publish images that the data does not reference', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'a.jpg' }]);
      writeImage('a.jpg');
      writeImage('orphan.jpg');

      emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'a.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'orphan.jpg'))).toBe(false);
    });

    it('copies an image referenced by more than one photo only once', () => {
      writeData([
        { id: '2024-01-15-parco-sempione-01', imageFile: 'a.jpg' },
        { id: '2024-01-15-parco-sempione-02', imageFile: 'a.jpg' },
      ]);
      writeImage('a.jpg');

      const result = emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(result).toMatchObject({ photos: 2, images: 1 });
      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'a.jpg'))).toBe(true);
    });

    it('creates the output directories when they do not exist', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'a.jpg' }]);
      writeImage('a.jpg');

      expect(fs.existsSync(OUT_DIR)).toBe(false);

      emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(fs.existsSync(path.join(OUT_DIR, 'data'))).toBe(true);
      expect(fs.existsSync(path.join(OUT_DIR, 'photos'))).toBe(true);
    });
  });

  describe('The publishing gate', () => {
    it('refuses to publish an image that still carries metadata', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'dirty.jpg' }]);
      writeImage('dirty.jpg', imageWithExif);

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/dirty\.jpg: exif/);
    });

    it('names every offending image', () => {
      writeData([
        { id: '2024-01-15-parco-sempione-01', imageFile: 'dirty-a.jpg' },
        { id: '2024-01-15-parco-sempione-02', imageFile: 'dirty-b.jpg' },
      ]);
      writeImage('dirty-a.jpg', imageWithExif);
      writeImage('dirty-b.jpg', imageWithExif);

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/dirty-a\.jpg[\s\S]*dirty-b\.jpg/);
    });

    it('refuses to publish a file that is not a readable image', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'broken.jpg' }]);
      fs.writeFileSync(path.join(PHOTO_DIR, 'broken.jpg'), 'not an image');

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/broken\.jpg: not a readable image/);
    });

    it('writes nothing when the gate rejects an image', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'dirty.jpg' }]);
      writeImage('dirty.jpg', imageWithExif);

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow();

      expect(fs.existsSync(path.join(OUT_DIR, 'data', 'photos.json'))).toBe(false);
    });

    it('publishes a clean image', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'clean.jpg' }]);
      writeImage('clean.jpg');

      const result = emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR });

      expect(result).toMatchObject({ photos: 1, images: 1 });
      expect(fs.existsSync(path.join(OUT_DIR, 'photos', 'clean.jpg'))).toBe(true);
    });
  });

  describe('Failing loudly', () => {
    it('fails with an actionable message when the data was never generated', () => {
      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/npm run build:data/);
    });

    it('fails when the data is not valid JSON', () => {
      fs.writeFileSync(DATA_FILE, 'not json');

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/not valid JSON/);
    });

    it('fails when the data has an unexpected shape', () => {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }));

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/unexpected shape/);
    });

    it('fails when a photo has no image file', () => {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ photos: [{ id: 'x' }] }));

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/imageFile/);
    });

    it('fails and names the missing images when a referenced file is absent', () => {
      writeData([
        { id: '2024-01-15-parco-sempione-01', imageFile: 'present.jpg' },
        { id: '2024-01-16-parco-vecchio-01', imageFile: 'absent.jpg' },
      ]);
      writeImage('present.jpg');

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow(/absent\.jpg/);
    });

    it('writes nothing when a referenced image is missing', () => {
      writeData([{ id: '2024-01-15-parco-sempione-01', imageFile: 'absent.jpg' }]);

      expect(() =>
        emitSiteAssets({ dataFile: DATA_FILE, photoDir: PHOTO_DIR, outDir: OUT_DIR }),
      ).toThrow();

      expect(fs.existsSync(path.join(OUT_DIR, 'data', 'photos.json'))).toBe(false);
    });
  });
});
