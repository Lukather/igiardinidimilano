import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { optimizeImage, type OptimizeResult } from './optimize-image';
import { IMAGE_BUDGET, isWithinBudget } from './image-budget';
import { findRemainingMetadata } from './image-metadata';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'optimize-image');

/** Heavy but compressible: over budget at full size, reachable at a lower one. */
const HEAVY = path.join(TEST_DIR, 'heavy.jpg');

/** Pure noise: cannot reach the budget within the quality floor, by design. */
const IMPOSSIBLE = path.join(TEST_DIR, 'impossible.jpg');

/** Small and light: already within budget at the starting quality. */
const SMALL = path.join(TEST_DIR, 'small.jpg');

const OUT_HEAVY = path.join(TEST_DIR, 'heavy-out.jpg');
const OUT_RELAXED = path.join(TEST_DIR, 'relaxed-out.jpg');
const OUT_IMPOSSIBLE = path.join(TEST_DIR, 'impossible-out.jpg');
const OUT_SMALL = path.join(TEST_DIR, 'small-out.jpg');

function noise(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = Math.floor(Math.random() * 256);
  }
  return pixels;
}

async function writeJpeg(file: string, pixels: Buffer, width: number, height: number, blur = 0) {
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (blur > 0) {
    image = image.blur(blur);
  }

  await image
    .withMetadata({ exif: { IFD0: { Make: 'TestCam', DateTime: '2024:01:15 10:00:00' } } })
    .jpeg({ quality: 100 })
    .toFile(file);
}

// Optimizing is expensive, so each scenario runs once and the tests assert on
// the recorded result.
let heavy: OptimizeResult;
let relaxed: OptimizeResult;
let impossible: OptimizeResult;
let small: OptimizeResult;

describe('Image optimization', () => {
  beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });

    await writeJpeg(HEAVY, noise(1600, 1200), 1600, 1200, 1);
    await writeJpeg(IMPOSSIBLE, noise(1600, 1200), 1600, 1200);
    await writeJpeg(SMALL, Buffer.alloc(400 * 300 * 3, 40), 400, 300);

    heavy = await optimizeImage(HEAVY, OUT_HEAVY);
    relaxed = await optimizeImage(HEAVY, OUT_RELAXED, {
      ...IMAGE_BUDGET,
      targetSizeKB: 400,
    });
    impossible = await optimizeImage(IMPOSSIBLE, OUT_IMPOSSIBLE);
    small = await optimizeImage(SMALL, OUT_SMALL);
  }, 120_000);

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, maxRetries: 3, retryDelay: 50, force: true });
  });

  describe('The budget is respected', () => {
    it('brings a heavy photo within the target size', () => {
      // The fixture must really be over budget, otherwise this proves nothing.
      expect(fs.statSync(HEAVY).size / 1024).toBeGreaterThan(IMAGE_BUDGET.targetSizeKB);

      expect(heavy.withinBudget).toBe(true);
      expect(heavy.sizeKB).toBeLessThanOrEqual(IMAGE_BUDGET.targetSizeKB);
      expect(fs.statSync(OUT_HEAVY).size / 1024).toBeLessThanOrEqual(IMAGE_BUDGET.targetSizeKB);
    });

    it('lowers the quality before giving up on the resolution', () => {
      // A budget this fixture can meet at full size, but not at the starting
      // quality: the resolution must be preserved.
      expect(relaxed.width).toBe(IMAGE_BUDGET.maxWidth);
      expect(relaxed.quality).toBeLessThan(IMAGE_BUDGET.qualityStart);
      expect(relaxed.withinBudget).toBe(true);
    });

    it('reduces the resolution only after exhausting the quality floor', () => {
      expect(heavy.quality).toBe(IMAGE_BUDGET.qualityMin);
      expect(heavy.width).toBeLessThan(IMAGE_BUDGET.maxWidth);
    });

    it('keeps the longest side within the configured maximum', () => {
      expect(Math.max(heavy.width, heavy.height)).toBeLessThanOrEqual(IMAGE_BUDGET.maxWidth);
    });

    it('never compresses below the quality floor', () => {
      for (const result of [heavy, relaxed, impossible, small]) {
        expect(result.quality).toBeGreaterThanOrEqual(IMAGE_BUDGET.qualityMin);
        expect(result.quality).toBeLessThanOrEqual(IMAGE_BUDGET.qualityStart);
      }
    });

    it('starts from the configured quality when that is enough', () => {
      expect(small.quality).toBe(IMAGE_BUDGET.qualityStart);
      expect(small.withinBudget).toBe(true);
    });
  });

  describe('When the budget cannot be met', () => {
    it('reports it instead of pushing the quality below the floor', () => {
      expect(impossible.withinBudget).toBe(false);
      expect(impossible.quality).toBe(IMAGE_BUDGET.qualityMin);
    });

    it('still writes the smallest acceptable file', () => {
      expect(fs.existsSync(OUT_IMPOSSIBLE)).toBe(true);
      expect(isWithinBudget(fs.statSync(OUT_IMPOSSIBLE).size)).toBe(false);
      expect(fs.statSync(OUT_IMPOSSIBLE).size / 1024).toBeCloseTo(impossible.sizeKB, 0);
    });
  });

  describe('What gets published', () => {
    it('carries no metadata', () => {
      expect(findRemainingMetadata(fs.readFileSync(OUT_HEAVY))).toEqual([]);
    });

    it('is a valid JPEG', async () => {
      expect((await sharp(OUT_HEAVY).metadata()).format).toBe('jpeg');
    });
  });

  describe('The budget is defined in one place', () => {
    it('exposes the values the documentation reports', () => {
      expect(IMAGE_BUDGET.targetSizeKB).toBe(300);
      expect(IMAGE_BUDGET.maxWidth).toBe(1600);
      expect(IMAGE_BUDGET.qualityMin).toBe(60);
    });

    it('measures a file against the budget', () => {
      expect(isWithinBudget(IMAGE_BUDGET.targetSizeKB * 1024)).toBe(true);
      expect(isWithinBudget(IMAGE_BUDGET.targetSizeKB * 1024 + 1)).toBe(false);
    });
  });
});
