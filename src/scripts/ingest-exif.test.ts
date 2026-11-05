import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { extractDateFromExif, findRemainingMetadata } from './ingest';

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
