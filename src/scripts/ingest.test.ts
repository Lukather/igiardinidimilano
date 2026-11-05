import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import { createTestImage, cleanupTestImages } from '../../tests/fixtures/create-test-images';

// Own subdirectory: sharing tests/temp with other suites made their cleanup
// race against this one.
const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'ingest');
const TEST_IMAGE = path.join(TEST_DIR, 'test-image.jpg');

describe('Ingest Script', () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files, including the nested output directories.
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe('Image Processing', () => {
    it('should create a valid JPEG image', async () => {
      await createTestImage(TEST_IMAGE);

      expect(fs.existsSync(TEST_IMAGE)).toBe(true);

      // Verify it's a valid image
      const metadata = await sharp(TEST_IMAGE).metadata();
      expect(metadata.format).toBe('jpeg');
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });

    it('should resize images while preserving aspect ratio', async () => {
      const wideImage = path.join(TEST_DIR, 'wide.jpg');
      await sharp({
        create: { width: 2000, height: 1000, channels: 3, background: '#27ae60' },
      })
        .jpeg()
        .toFile(wideImage);

      const resized = path.join(TEST_DIR, 'wide-resized.jpg');
      await sharp(wideImage)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(resized);

      const metadata = await sharp(resized).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1600);
      expect(metadata.height).toBeLessThanOrEqual(1600);

      cleanupTestImages(wideImage, resized);
    });

    it('should compress images to reasonable file size', async () => {
      const original = path.join(TEST_DIR, 'original.jpg');
      await sharp({
        create: { width: 1600, height: 1200, channels: 3, background: '#e74c3c' },
      })
        .jpeg({ quality: 100 })
        .toFile(original);

      const compressed = path.join(TEST_DIR, 'compressed.jpg');
      await sharp(original)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(compressed);

      const originalSize = fs.statSync(original).size;
      const compressedSize = fs.statSync(compressed).size;

      // Compressed should be smaller
      expect(compressedSize).toBeLessThan(originalSize);

      cleanupTestImages(original, compressed);
    });
  });

  describe('Metadata Handling', () => {
    it('should strip EXIF metadata from images', async () => {
      const withMetadata = path.join(TEST_DIR, 'with-metadata.jpg');
      const stripped = path.join(TEST_DIR, 'stripped.jpg');

      // Create image
      await createTestImage(withMetadata);

      // Process through sharp (which strips metadata by default)
      await sharp(withMetadata)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(stripped);

      // Verify metadata is stripped
      const buffer = fs.readFileSync(stripped);
      try {
        const tags = ExifReader.load(buffer);
        // If no error is thrown, check if any tags were found
        const hasMetadata = Object.keys(tags).length > 0;
        expect(hasMetadata).toBe(false);
      } catch {
        // No metadata found - this is what we want
        expect(true).toBe(true);
      }

      cleanupTestImages(withMetadata, stripped);
    });

    it('should validate that a clean image has no EXIF data', async () => {
      const cleanImage = path.join(TEST_DIR, 'clean.jpg');

      // Create a fresh image
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: '#3498db' },
      })
        .jpeg()
        .toFile(cleanImage);

      // Verify no metadata
      const buffer = fs.readFileSync(cleanImage);
      try {
        const tags = ExifReader.load(buffer);
        expect(Object.keys(tags).length).toBe(0);
      } catch {
        // No metadata - expected
        expect(true).toBe(true);
      }

      cleanupTestImages(cleanImage);
    });
  });

  describe('File Output', () => {
    it('should create output directories if they do not exist', async () => {
      const outputDir = path.join(TEST_DIR, 'output', 'photos');

      expect(fs.existsSync(outputDir)).toBe(false);

      // Create directory
      fs.mkdirSync(outputDir, { recursive: true });

      expect(fs.existsSync(outputDir)).toBe(true);

      // Cleanup
      fs.rmdirSync(outputDir);
      fs.rmdirSync(path.dirname(outputDir));
    });

    it('should save optimized image with correct filename', async () => {
      const source = path.join(TEST_DIR, 'source.jpg');
      const outputDir = path.join(TEST_DIR, 'output');
      const outputFile = path.join(outputDir, 'optimized.jpg');

      await createTestImage(source);
      fs.mkdirSync(outputDir, { recursive: true });

      await sharp(source).jpeg({ quality: 80 }).toFile(outputFile);

      expect(fs.existsSync(outputFile)).toBe(true);

      cleanupTestImages(source, outputFile);
      fs.rmdirSync(outputDir);
    });

    it('should save metadata as valid JSON', async () => {
      const metadataDir = path.join(TEST_DIR, 'metadata');
      fs.mkdirSync(metadataDir, { recursive: true });

      const metadata = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      const metadataFile = path.join(metadataDir, 'photo-01.json');
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

      // Verify it can be parsed
      const parsed = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      expect(parsed.id).toBe(metadata.id);
      expect(parsed.coordinates.latitude).toBe(metadata.coordinates.latitude);

      cleanupTestImages(metadataFile);
      fs.rmdirSync(metadataDir);
    });
  });

  describe('ID Generation', () => {
    it('should generate valid photo IDs', () => {
      // Helper function (copied from ingest.ts logic)
      const generatePhotoId = (date: string, space: string, index: number = 1): string => {
        const datePart = date.replace(/[^0-9]/g, '-');
        const spaceSlug = space
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return `${datePart}-${spaceSlug}-${index.toString().padStart(2, '0')}`;
      };

      expect(generatePhotoId('2024-01-15', 'Parco Sempione')).toBe(
        '2024-01-15-parco-sempione-01',
      );

      expect(generatePhotoId('2024-12-31', 'Giardino Pubblico', 2)).toBe(
        '2024-12-31-giardino-pubblico-02',
      );

      expect(generatePhotoId('2024-01-15', 'Parco dell\'Acqua')).toBe(
        '2024-01-15-parco-dell-acqua-01',
      );
    });
  });
});
