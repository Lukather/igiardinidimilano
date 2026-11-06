import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { extractDateFromExif, extractGPSFromExif, toDecimalDegrees } from './ingest';
import { findRemainingMetadata } from './image-metadata';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'ingest-exif');

/** Create a JPEG carrying the given EXIF IFD0 tags. */
async function imageWithExif(file: string, exif: Record<string, string>): Promise<void> {
  await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 40, g: 90, b: 40 } },
  })
    .withMetadata({ exif: { IFD0: exif } })
    .jpeg()
    .toFile(file);
}

describe('Date from EXIF', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it('reads the date the camera recorded', async () => {
    const file = path.join(TEST_DIR, 'with-date.jpg');
    await imageWithExif(file, { DateTime: '2024:05:20 10:30:00' });

    expect(extractDateFromExif(file)).toBe('2024-05-20');
  });

  it('handles a single digit day and month', async () => {
    const file = path.join(TEST_DIR, 'single-digits.jpg');
    await imageWithExif(file, { DateTime: '2024:01:05 08:00:00' });

    expect(extractDateFromExif(file)).toBe('2024-01-05');
  });

  it('returns null when the photo carries no date', async () => {
    const file = path.join(TEST_DIR, 'no-date.jpg');
    await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 40, g: 90, b: 40 } },
    })
      .jpeg()
      .toFile(file);

    expect(extractDateFromExif(file)).toBeNull();
  });

  describe('Metadata stripping check', () => {
    it('reports the metadata groups present in a photo with EXIF', async () => {
      const file = path.join(TEST_DIR, 'with-metadata.jpg');
      await imageWithExif(file, { DateTime: '2024:05:20 10:30:00', Make: 'TestCam' });

      expect(findRemainingMetadata(fs.readFileSync(file))).toContain('exif');
    });

    it('reports nothing for an image published through sharp', async () => {
      const source = path.join(TEST_DIR, 'source-for-strip.jpg');
      const stripped = path.join(TEST_DIR, 'stripped.jpg');
      await imageWithExif(source, { DateTime: '2024:05:20 10:30:00', Make: 'TestCam' });

      // Same pipeline the ingest uses to publish.
      await sharp(source).rotate().resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(stripped);

      expect(findRemainingMetadata(fs.readFileSync(stripped))).toEqual([]);
    });
  });

  it('returns null instead of throwing when the file is not an image', () => {
    const file = path.join(TEST_DIR, 'not-an-image.jpg');
    fs.writeFileSync(file, 'this is not a jpeg');

    // The warning is the intended behaviour; keep it out of the test output.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(extractDateFromExif(file)).toBeNull();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe('GPS from EXIF', () => {
  /**
   * The exact shape ExifReader returns for a real phone photo. Each component
   * is a rational pair, not a number — assuming otherwise is what made the
   * ingest publish a string and then throw on `toFixed`.
   */
  const RATIONAL_LATITUDE = {
    value: [[45, 1], [29, 1], [48917760, 1000000]],
    description: 45.4969216,
  };
  const RATIONAL_LONGITUDE = {
    value: [[9, 1], [12, 1], [33376319, 1000000]],
    description: 9.209271199722222,
  };

  describe('Decimal degrees', () => {
    it('reads the rational-pair form ExifReader actually returns', () => {
      expect(toDecimalDegrees(RATIONAL_LATITUDE)).toBeCloseTo(45.4969216, 6);
      expect(toDecimalDegrees(RATIONAL_LONGITUDE)).toBeCloseTo(9.2092712, 6);
    });

    it('reads plain degree/minute/second numbers', () => {
      expect(toDecimalDegrees({ value: [45, 29, 48.91776] })).toBeCloseTo(45.4969216, 6);
    });

    it('prefers the description when it is a finite number', () => {
      expect(toDecimalDegrees({ value: 'unreadable', description: 45.5 })).toBe(45.5);
    });

    it('returns null instead of a string when the value is not numeric', () => {
      // The old code returned "[45,1]NaNNaN" here, and the caller threw.
      expect(toDecimalDegrees({ value: 'not-degrees' })).toBeNull();
      expect(toDecimalDegrees({ value: [[45, 1], [29, 0], [1, 1]] })).toBeNull();
    });

    it('returns null for a missing tag', () => {
      expect(toDecimalDegrees(undefined)).toBeNull();
    });
  });

  describe('Reading a file', () => {
    // The earlier describe removes the directory in its own afterAll.
    beforeAll(() => {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    });

    it('reports no GPS for a photo without GPS tags', async () => {
      const file = path.join(TEST_DIR, 'no-gps.jpg');
      await imageWithExif(file, { Make: 'TestCam', DateTime: '2024:05:20 10:30:00' });

      const result = await extractGPSFromExif(file);

      expect(result.error).toBe('No GPS data found in photo EXIF');
      expect(result.latitude).toBeUndefined();
    });

    it('reports an error instead of throwing when the file is missing', async () => {
      const result = await extractGPSFromExif(path.join(TEST_DIR, 'does-not-exist.jpg'));

      expect(result.error).toBeTruthy();
    });
  });
});
