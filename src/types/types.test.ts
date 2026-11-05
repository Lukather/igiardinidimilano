import { describe, it, expect } from 'vitest';
import {
  Photo,
  Coordinates,
  MILAN_BOUNDS,
  PHOTO_CATEGORIES,
} from './types';
import {
  validatePhoto,
  safeValidatePhoto,
  validatePhotos,
} from './schemas';
import {
  isValidCategory,
  isInMilan,
  isValidCoordinates,
  isValidDate,
  isValidId,
  generateId,
  calculateStats,
  validateAllPhotos,
  validatePhotoDetailed,
} from './validation';

describe('Types', () => {
  describe('PhotoCategory', () => {
    it('should have exactly two valid categories', () => {
      expect(PHOTO_CATEGORIES).toEqual(['curato', 'in degrado']);
    });
  });

  describe('MILAN_BOUNDS', () => {
    it('should have valid bounds for Milan', () => {
      expect(MILAN_BOUNDS.minLatitude).toBe(45.35);
      expect(MILAN_BOUNDS.maxLatitude).toBe(45.55);
      expect(MILAN_BOUNDS.minLongitude).toBe(8.95);
      expect(MILAN_BOUNDS.maxLongitude).toBe(9.30);
    });
  });
});

describe('Validation Utilities', () => {
  describe('isValidCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidCategory('curato')).toBe(true);
      expect(isValidCategory('in degrado')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidCategory('valid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory('curato ')).toBe(false);
    });
  });

  describe('isInMilan', () => {
    it('should return true for coordinates within Milan', () => {
      const coords: Coordinates = {
        latitude: 45.4642,
        longitude: 9.1900,
      };
      expect(isInMilan(coords)).toBe(true);
    });

    it('should return false for coordinates outside Milan', () => {
      const coordsOutside: Coordinates = {
        latitude: 45.0,
        longitude: 9.0,
      };
      expect(isInMilan(coordsOutside)).toBe(false);
    });
  });

  describe('isValidCoordinates', () => {
    it('should return true for valid coordinates', () => {
      const coords: Coordinates = {
        latitude: 45.4642,
        longitude: 9.1900,
      };
      expect(isValidCoordinates(coords)).toBe(true);
    });

    it('should return false for NaN coordinates', () => {
      const coords: Coordinates = {
        latitude: NaN,
        longitude: 9.1900,
      };
      expect(isValidCoordinates(coords)).toBe(false);
    });

    it('should return false for Infinity coordinates', () => {
      const coords: Coordinates = {
        latitude: Infinity,
        longitude: 9.1900,
      };
      expect(isValidCoordinates(coords)).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid dates', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2020-12-31')).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(isValidDate('2024-13-01')).toBe(false);
      expect(isValidDate('2024-01-32')).toBe(false);
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate('2024/01/15')).toBe(false);
    });
  });

  describe('isValidId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidId('2024-01-15-parco-sempione-01')).toBe(true);
      expect(isValidId('2024-12-31-giardino-pubblico-99')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidId('invalid')).toBe(false);
      expect(isValidId('2024-01-15')).toBe(false);
      expect(isValidId('2024/01/15-parco')).toBe(false);
    });
  });

  describe('generateId', () => {
    it('should generate valid IDs', () => {
      const id = generateId('2024-01-15', 'Parco Sempione');
      expect(id).toBe('2024-01-15-parco-sempione-01');
    });

    it('should handle different indices', () => {
      const id1 = generateId('2024-01-15', 'Parco Sempione', 1);
      const id2 = generateId('2024-01-15', 'Parco Sempione', 2);
      expect(id1).toBe('2024-01-15-parco-sempione-01');
      expect(id2).toBe('2024-01-15-parco-sempione-02');
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct stats', () => {
      const photos: Photo[] = [
        {
          id: '2024-01-15-parco-sempione-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
        {
          id: '2024-01-16-parco-sempione-02',
          category: 'curato',
          coordinates: { latitude: 45.4645, longitude: 9.1905 },
          date: '2024-01-16',
          description: 'Altra zona curata',
          space: 'Parco Sempione',
          imageFile: '2024-01-16-parco-sempione-02.jpg',
        },
        {
          id: '2024-01-17-parco-vecchio-01',
          category: 'in degrado',
          coordinates: { latitude: 45.4500, longitude: 9.1800 },
          date: '2024-01-17',
          description: 'Parco in degrado',
          space: 'Parco Vecchio',
          imageFile: '2024-01-17-parco-vecchio-01.jpg',
        },
      ];

      const stats = calculateStats(photos);
      expect(stats.totalPhotos).toBe(3);
      expect(stats.curatedSpaces).toBe(1); // Only one unique space with 'curato'
      expect(stats.degradedSpaces).toBe(1); // Only one unique space with 'in degrado'
    });
  });
});

describe('Zod Schemas', () => {
  describe('validatePhoto', () => {
    it('should validate a valid photo', () => {
      const validPhoto: Photo = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      const result = validatePhoto(validPhoto);
      expect(result).toEqual(validPhoto);
    });

    it('should throw for invalid category', () => {
      const invalidPhoto = {
        id: '2024-01-15-parco-sempione-01',
        category: 'invalid',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      expect(() => validatePhoto(invalidPhoto)).toThrow();
    });

    it('should throw for coordinates outside Milan', () => {
      const invalidPhoto = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 40.0, longitude: 9.0 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      expect(() => validatePhoto(invalidPhoto)).toThrow();
    });

    it('should throw for invalid date format', () => {
      const invalidPhoto = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '15-01-2024',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      expect(() => validatePhoto(invalidPhoto)).toThrow();
    });

    it('should throw for invalid ID format', () => {
      const invalidPhoto = {
        id: 'invalid-id',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      expect(() => validatePhoto(invalidPhoto)).toThrow();
    });
  });

  describe('safeValidatePhoto', () => {
    it('should return success for valid photo', () => {
      const validPhoto: Photo = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      const result = safeValidatePhoto(validPhoto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validPhoto);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid photo', () => {
      const invalidPhoto = {
        id: 'invalid-id',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      const result = safeValidatePhoto(invalidPhoto);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('validatePhotos', () => {
    it('should validate multiple valid photos', () => {
      const validPhotos: Photo[] = [
        {
          id: '2024-01-15-parco-sempione-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
        {
          id: '2024-01-16-parco-vecchio-01',
          category: 'in degrado',
          coordinates: { latitude: 45.4500, longitude: 9.1800 },
          date: '2024-01-16',
          description: 'Parco in degrado',
          space: 'Parco Vecchio',
          imageFile: '2024-01-16-parco-vecchio-01.jpg',
        },
      ];

      const result = validatePhotos(validPhotos);
      expect(result).toEqual(validPhotos);
    });

    it('should throw for array with invalid photo', () => {
      const photos = [
        {
          id: '2024-01-15-parco-sempione-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
        {
          id: 'invalid-id',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
      ];

      expect(() => validatePhotos(photos)).toThrow();
    });
  });

  describe('validatePhotoDetailed', () => {
    it('should return empty array for valid photo', () => {
      const validPhoto: Photo = {
        id: '2024-01-15-parco-sempione-01',
        category: 'curato',
        coordinates: { latitude: 45.4642, longitude: 9.1900 },
        date: '2024-01-15',
        description: 'Parco ben curato',
        space: 'Parco Sempione',
        imageFile: '2024-01-15-parco-sempione-01.jpg',
      };

      const errors = validatePhotoDetailed(validPhoto);
      expect(errors).toEqual([]);
    });

    it('should return error messages for invalid photo', () => {
      const invalidPhoto = {
        id: 'invalid-id',
        category: 'invalid',
        coordinates: { latitude: 40.0, longitude: 9.0 },
        date: 'invalid-date',
        description: 'x', // Too short
        space: '', // Empty
        imageFile: 'invalid.ext', // Invalid extension
      };

      const errors = validatePhotoDetailed(invalidPhoto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('id:');
    });
  });

  describe('validateAllPhotos', () => {
    it('should separate valid and invalid photos', () => {
      const photos = [
        {
          id: '2024-01-15-parco-sempione-01',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
        {
          id: 'invalid-id',
          category: 'curato',
          coordinates: { latitude: 45.4642, longitude: 9.1900 },
          date: '2024-01-15',
          description: 'Parco ben curato',
          space: 'Parco Sempione',
          imageFile: '2024-01-15-parco-sempione-01.jpg',
        },
      ];

      const result = validateAllPhotos(photos);
      expect(result.valid.length).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].photoId).toBe('invalid-id');
    });
  });
});
