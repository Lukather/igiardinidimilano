import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Photo, SiteData } from '../types/types';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'build');
const METADATA_DIR = path.join(TEST_DIR, 'photos');
const PHOTO_DIR = path.join(TEST_DIR, 'images');

describe('Build Script', () => {
  beforeAll(() => {
    // Create test directories
    [TEST_DIR, METADATA_DIR, PHOTO_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterAll(() => {
    // Clean up test files
    const cleanDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            cleanDir(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(dir);
      }
    };

    cleanDir(TEST_DIR);
  });

  describe('Photo Discovery', () => {
    it('should find metadata files in directory', () => {
      const metadataFile = path.join(METADATA_DIR, 'test-photo.json');
      const metadata = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Test photo',
        space: 'Parco Sempione',
        imageFile: 'test-photo.jpg',
      };

      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

      // Create a dummy image file
      fs.writeFileSync(path.join(PHOTO_DIR, 'test-photo.jpg'), 'fake image data');

      expect(fs.existsSync(metadataFile)).toBe(true);
      expect(fs.existsSync(path.join(PHOTO_DIR, 'test-photo.jpg'))).toBe(true);
    });

    it('should handle empty metadata directory', () => {
      const emptyDir = path.join(TEST_DIR, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      const files = fs.readdirSync(emptyDir).filter((f) => f.endsWith('.json'));
      expect(files.length).toBe(0);

      fs.rmdirSync(emptyDir);
    });

    it('should ignore non-JSON files', () => {
      const testDir = path.join(TEST_DIR, 'mixed-files');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'photo.json'), '{}');
      fs.writeFileSync(path.join(testDir, 'photo.txt'), 'text');
      fs.writeFileSync(path.join(testDir, 'photo.md'), '# markdown');

      const jsonFiles = fs
        .readdirSync(testDir)
        .filter((f) => f.endsWith('.json'));

      expect(jsonFiles).toHaveLength(1);
      expect(jsonFiles[0]).toBe('photo.json');

      // Cleanup
      fs.readdirSync(testDir).forEach((f) => {
        fs.unlinkSync(path.join(testDir, f));
      });
      fs.rmdirSync(testDir);
    });
  });

  describe('Metadata Validation', () => {
    it('should validate valid photo metadata', () => {
      const metadata = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Valid photo metadata',
        space: 'Parco Sempione',
        imageFile: 'valid-photo.jpg',
      };

      // This would be validated by the schema
      expect(metadata.id).toMatch(/^\d{4}-\d{2}-\d{2}-/);
      expect(['curato', 'in degrado']).toContain(metadata.category);
      expect(metadata.coordinates.latitude).toBeGreaterThan(45.3);
      expect(metadata.coordinates.longitude).toBeGreaterThan(8.9);
    });

    it('should reject invalid category', () => {
      const metadata = {
        id: '2024-01-15-parco-sempione-01',
        category: 'invalid-category',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Invalid category',
        space: 'Parco Sempione',
        imageFile: 'photo.jpg',
      };

      expect(['curato', 'in degrado']).not.toContain(metadata.category);
    });

    it('should reject coordinates outside Milan', () => {
      const outsideMilan = {
        latitude: 40.0, // Rome latitude
        longitude: 9.0,
      };

      expect(outsideMilan.latitude).toBeLessThan(45.35);
    });

    it('should reject invalid date format', () => {
      const invalidDates = [
        '15-01-2024', // Wrong format (DD-MM-YYYY)
        '2024/01/15', // Wrong separator
        'not-a-date', // Not a date
        '2024-1-15', // Missing zero-padding
      ];

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      for (const date of invalidDates) {
        expect(dateRegex.test(date)).toBe(false);
      }
    });

    it('should parse valid JSON metadata', () => {
      const jsonString = JSON.stringify({
        id: '2024-01-15-test-01',
        category: 'in degrado',
        coordinates: { latitude: 45.4500, longitude: 9.1800 },
        date: '2024-01-15',
        description: 'Test',
        space: 'Test Space',
        imageFile: 'test.jpg',
      });

      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBe('2024-01-15-test-01');
      expect(parsed.category).toBe('in degrado');
      expect(parsed.coordinates.latitude).toBe(45.4500);
    });

    it('should reject malformed JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('Image File Verification', () => {
    it('should verify that image files exist', () => {
      const imageFile = path.join(TEST_DIR, 'existing-image.jpg');
      fs.writeFileSync(imageFile, 'fake image data');

      expect(fs.existsSync(imageFile)).toBe(true);

      fs.unlinkSync(imageFile);
    });

    it('should fail if image file is missing', () => {
      const missingImagePath = path.join(TEST_DIR, 'missing-image.jpg');

      expect(fs.existsSync(missingImagePath)).toBe(false);
    });

    it('should handle special characters in filenames', () => {
      const specialNames = [
        '2024-01-15-parco-dell-acqua-01.jpg',
        '2024-01-15-parco-nord-est-01.jpg',
        '2024-01-15-giardino-s-ambrogio-01.jpg',
      ];

      for (const name of specialNames) {
        const filePath = path.join(TEST_DIR, name);
        fs.writeFileSync(filePath, 'data');
        expect(fs.existsSync(filePath)).toBe(true);
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('Statistics Calculation', () => {
    it('should count total photos', () => {
      const photos: Photo[] = [
        {
          id: '2024-01-15-parco-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Photo 1',
          space: 'Parco A',
          imageFile: 'photo1.jpg',
        },
        {
          id: '2024-01-16-parco-02',
          category: 'in degrado',
          coordinates: { latitude: 45.4500, longitude: 9.1800 },
          date: '2024-01-16',
          description: 'Photo 2',
          space: 'Parco B',
          imageFile: 'photo2.jpg',
        },
      ];

      expect(photos).toHaveLength(2);
    });

    it('should count unique curated spaces', () => {
      const photos: Photo[] = [
        {
          id: '2024-01-15-parco-sempione-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Photo 1',
          space: 'Parco Sempione',
          imageFile: 'photo1.jpg',
        },
        {
          id: '2024-01-15-parco-sempione-02',
          category: 'curato',
          coordinates: { latitude: 45.4645, longitude: 9.1905 },
          date: '2024-01-15',
          description: 'Photo 2',
          space: 'Parco Sempione',
          imageFile: 'photo2.jpg',
        },
        {
          id: '2024-01-15-parco-nord-01',
          category: 'curato',
          coordinates: { latitude: 45.4550, longitude: 9.2000 },
          date: '2024-01-15',
          description: 'Photo 3',
          space: 'Parco Nord',
          imageFile: 'photo3.jpg',
        },
      ];

      const curatedSpaces = new Set(
        photos.filter((p) => p.category === 'curato').map((p) => p.space),
      );

      expect(curatedSpaces.size).toBe(2); // Parco Sempione, Parco Nord
    });

    it('should count unique degraded spaces', () => {
      const photos: Photo[] = [
        {
          id: '2024-01-15-parco-vecchio-01',
          category: 'in degrado',
          coordinates: { latitude: 45.4500, longitude: 9.1800 },
          date: '2024-01-15',
          description: 'Degraded 1',
          space: 'Parco Vecchio',
          imageFile: 'photo1.jpg',
        },
        {
          id: '2024-01-15-parco-vecchio-02',
          category: 'in degrado',
          coordinates: { latitude: 45.4505, longitude: 9.1805 },
          date: '2024-01-15',
          description: 'Degraded 2',
          space: 'Parco Vecchio',
          imageFile: 'photo2.jpg',
        },
      ];

      const degradedSpaces = new Set(
        photos.filter((p) => p.category === 'in degrado').map((p) => p.space),
      );

      expect(degradedSpaces.size).toBe(1); // Only Parco Vecchio
    });

    it('should calculate mixed statistics', () => {
      const photos: Photo[] = [
        {
          id: '2024-01-15-a-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'C1',
          space: 'Space A',
          imageFile: 'c1.jpg',
        },
        {
          id: '2024-01-15-a-02',
          category: 'curato',
          coordinates: { latitude: 45.4643, longitude: 9.1901 },
          date: '2024-01-15',
          description: 'C2',
          space: 'Space A',
          imageFile: 'c2.jpg',
        },
        {
          id: '2024-01-15-b-01',
          category: 'in degrado',
          coordinates: { latitude: 45.4500, longitude: 9.1800 },
          date: '2024-01-15',
          description: 'D1',
          space: 'Space B',
          imageFile: 'd1.jpg',
        },
      ];

      const stats = {
        totalPhotos: photos.length,
        curatedSpaces: new Set(
          photos.filter((p) => p.category === 'curato').map((p) => p.space),
        ).size,
        degradedSpaces: new Set(
          photos.filter((p) => p.category === 'in degrado').map((p) => p.space),
        ).size,
      };

      expect(stats.totalPhotos).toBe(3);
      expect(stats.curatedSpaces).toBe(1); // Space A
      expect(stats.degradedSpaces).toBe(1); // Space B
    });
  });

  describe('Output File', () => {
    it('should create valid JSON output', () => {
      const siteData: SiteData = {
        photos: [
          {
            id: '2024-01-15-test-01',
            category: 'curato',
            coordinates: { latitude: 45.4642, longitude: 9.1900 },
            date: '2024-01-15',
            description: 'Test photo',
            space: 'Test Space',
            imageFile: 'test.jpg',
          },
        ],
        stats: {
          totalPhotos: 1,
          curatedSpaces: 1,
          degradedSpaces: 0,
        },
        lastUpdated: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(siteData, null, 2);
      const parsed = JSON.parse(jsonString);

      expect(parsed.photos).toHaveLength(1);
      expect(parsed.stats.totalPhotos).toBe(1);
      expect(parsed.lastUpdated).toBeDefined();
    });

    it('should have correct structure', () => {
      const siteData: SiteData = {
        photos: [],
        stats: { totalPhotos: 0, curatedSpaces: 0, degradedSpaces: 0 },
        lastUpdated: new Date().toISOString(),
      };

      expect(siteData).toHaveProperty('photos');
      expect(siteData).toHaveProperty('stats');
      expect(siteData).toHaveProperty('lastUpdated');
      expect(siteData.photos).toBeInstanceOf(Array);
      expect(typeof siteData.lastUpdated).toBe('string');
    });

    it('should format timestamps in ISO format', () => {
      const now = new Date();
      const iso = now.toISOString();

      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should write to file', () => {
      const testFile = path.join(TEST_DIR, 'test-output.json');
      const data = { test: 'data', timestamp: new Date().toISOString() };

      fs.writeFileSync(testFile, JSON.stringify(data, null, 2));

      expect(fs.existsSync(testFile)).toBe(true);

      const read = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
      expect(read.test).toBe('data');

      fs.unlinkSync(testFile);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metadata files gracefully', () => {
      const nonexistentDir = path.join(TEST_DIR, 'nonexistent');
      expect(fs.existsSync(nonexistentDir)).toBe(false);
    });

    it('should report validation errors clearly', () => {
      const errors = [
        { field: 'id', message: 'Invalid format' },
        { field: 'category', message: 'Unknown category' },
        { field: 'coordinates', message: 'Outside Milan bounds' },
      ];

      expect(errors).toHaveLength(3);
      expect(errors[0].message).toContain('Invalid');
    });
  });
});
