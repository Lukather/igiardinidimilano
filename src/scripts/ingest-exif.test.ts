import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { extractDateFromExif, extractGPSFromExif } from './ingest';
import { findRemainingMetadata } from './image-metadata';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'ingest-exif');

/**
 * Create a JPEG carrying the given EXIF IFD0 tags, plus tags in other IFDs
 * when given (IFD2 is the Exif block, IFD3 the GPS block).
 */
async function imageWithExif(
  file: string,
  exif: Record<string, string>,
  otherIfds: Record<string, Record<string, string>> = {},
): Promise<void> {
  await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 40, g: 90, b: 40 } },
  })
    .withMetadata({ exif: { IFD0: exif, ...otherIfds } })
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

  it('prefers the date the shutter fired over the date the file was edited', async () => {
    const file = path.join(TEST_DIR, 'both-dates.jpg');
    await imageWithExif(
      file,
      { DateTime: '2030:01:01 00:00:00' },
      { IFD2: { DateTimeOriginal: '2024:05:20 10:30:00' } },
    );

    expect(extractDateFromExif(file)).toBe('2024-05-20');
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
  describe('Reading a file', () => {
    // The earlier describe removes the directory in its own afterAll.
    beforeAll(() => {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    });

    // A real EXIF GPS block, as a phone writes it: unsigned degrees/minutes/seconds
    // plus a N/S and E/W reference. This is the form that has to come out signed.
    it('reads north and east as positive decimal degrees', async () => {
      const file = path.join(TEST_DIR, 'gps-north-east.jpg');
      await imageWithExif(file, {}, {
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '45/1 29/1 48917760/1000000',
          GPSLongitudeRef: 'E',
          GPSLongitude: '9/1 12/1 33376319/1000000',
        },
      });

      const result = await extractGPSFromExif(file);

      expect(result.error).toBeUndefined();
      expect(result.latitude).toBeCloseTo(45.4969216, 6);
      expect(result.longitude).toBeCloseTo(9.2092712, 6);
    });

    it('reads south and west as negative decimal degrees', async () => {
      const file = path.join(TEST_DIR, 'gps-south-west.jpg');
      await imageWithExif(file, {}, {
        IFD3: {
          GPSLatitudeRef: 'S',
          GPSLatitude: '33/1 52/1 0/1',
          GPSLongitudeRef: 'W',
          GPSLongitude: '70/1 40/1 30/1',
        },
      });

      const result = await extractGPSFromExif(file);

      expect(result.latitude).toBeCloseTo(-33.8666667, 6);
      expect(result.longitude).toBeCloseTo(-70.675, 6);
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
