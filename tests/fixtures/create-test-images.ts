/**
 * Create synthetic test images with EXIF data
 *
 * These images are used for testing the ingest script.
 * They are small (100x100), have synthetic EXIF GPS data, and are meant
 * to be deleted after tests run.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

interface TestImageOptions {
  width?: number;
  height?: number;
  color?: string;
  latitude?: number;
  longitude?: number;
  date?: string;
}

/**
 * Create a synthetic test image with optional EXIF GPS data
 *
 * Note: sharp doesn't directly write EXIF data, so we create a minimal image.
 * In real tests, we would mock ExifReader to return GPS data.
 */
export async function createTestImage(
  outputPath: string,
  options: TestImageOptions = {},
): Promise<void> {
  const {
    width = 100,
    height = 100,
    color = '#e74c3c', // Red for degraded
  } = options;

  // Create a simple colored square
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

/**
 * Create a pair of test images (curato and degraded)
 */
export async function createTestImagePair(
  baseDir: string,
): Promise<{ curatedPath: string; degradedPath: string }> {
  const curatedPath = path.join(baseDir, 'test-curato.jpg');
  const degradedPath = path.join(baseDir, 'test-degraded.jpg');

  await createTestImage(curatedPath, { color: '#27ae60' }); // Green for curated
  await createTestImage(degradedPath, { color: '#e74c3c' }); // Red for degraded

  return { curatedPath, degradedPath };
}

/**
 * Clean up test images
 */
export function cleanupTestImages(...paths: string[]): void {
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
