import { describe, it, expect } from 'vitest';
import {
  buildPhotoMetadata,
  parseCategoryAnswer,
  parseCoordinatesAnswer,
  parseDateAnswer,
  type PhotoMetadataInput,
} from './ingest-input';

const COORDINATES = { latitude: 45.4719, longitude: 9.1738 };

function metadata(overrides: Partial<PhotoMetadataInput> = {}): PhotoMetadataInput {
  return {
    id: '2024-01-15-parco-sempione-01',
    category: 'curato',
    coordinates: COORDINATES,
    date: '2024-01-15',
    description: 'Parco ben mantenuto, prato verde',
    space: 'Parco Sempione',
    imageFile: '2024-01-15-parco-sempione-01.jpg',
    ...overrides,
  };
}

describe('Ingest input', () => {
  describe('Date proposed from EXIF', () => {
    it('accepts the proposal when the answer is empty', () => {
      expect(parseDateAnswer('', '2024-01-15')).toEqual({ ok: true, date: '2024-01-15' });
    });

    it('accepts the proposal when the answer is only whitespace', () => {
      expect(parseDateAnswer('   ', '2024-01-15')).toEqual({ ok: true, date: '2024-01-15' });
    });

    it('lets a typed date override the proposal', () => {
      expect(parseDateAnswer('2024-02-20', '2024-01-15')).toEqual({
        ok: true,
        date: '2024-02-20',
      });
    });

    it('requires a date when there is no proposal', () => {
      const result = parseDateAnswer('', null);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toMatch(/date is required/i);
    });

    it('rejects a malformed date and says what was wrong', () => {
      const result = parseDateAnswer('15/01/2024', '2024-01-15');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('15/01/2024');
      expect(result.ok === false && result.error).toContain('YYYY-MM-DD');
    });

    it('trims a typed date', () => {
      expect(parseDateAnswer('  2024-03-01  ', null)).toEqual({ ok: true, date: '2024-03-01' });
    });
  });

  describe('Category', () => {
    it('accepts the known categories', () => {
      expect(parseCategoryAnswer('curato')).toBe('curato');
      expect(parseCategoryAnswer('in degrado')).toBe('in degrado');
    });

    it('tolerates case and surrounding whitespace', () => {
      expect(parseCategoryAnswer('  Curato ')).toBe('curato');
      expect(parseCategoryAnswer('IN DEGRADO')).toBe('in degrado');
    });

    it('rejects anything else', () => {
      expect(parseCategoryAnswer('disastrato')).toBeNull();
      expect(parseCategoryAnswer('')).toBeNull();
      expect(parseCategoryAnswer('curato!')).toBeNull();
    });
  });

  describe('Coordinates', () => {
    it('accepts the proposal on an empty answer or "y"', () => {
      expect(parseCoordinatesAnswer('', COORDINATES)).toEqual(COORDINATES);
      expect(parseCoordinatesAnswer('y', COORDINATES)).toEqual(COORDINATES);
      expect(parseCoordinatesAnswer('Y', COORDINATES)).toEqual(COORDINATES);
    });

    it('cancels on "n"', () => {
      expect(parseCoordinatesAnswer('n', COORDINATES)).toBeNull();
    });

    it('accepts corrected coordinates', () => {
      expect(parseCoordinatesAnswer('45.5, 9.2', COORDINATES)).toEqual({
        latitude: 45.5,
        longitude: 9.2,
      });
    });

    it('rejects unparseable input', () => {
      expect(parseCoordinatesAnswer('qui', COORDINATES)).toBeNull();
      expect(parseCoordinatesAnswer('45.5', COORDINATES)).toBeNull();
      expect(parseCoordinatesAnswer('a, b', COORDINATES)).toBeNull();
    });
  });

  describe('Metadata validation before writing', () => {
    it('returns the metadata when it is valid', () => {
      const result = buildPhotoMetadata(metadata());

      expect(result.id).toBe('2024-01-15-parco-sempione-01');
      expect(result.category).toBe('curato');
    });

    it('rejects a category outside the enum, naming the field', () => {
      const invalid = { ...metadata(), category: 'disastrato' } as unknown as PhotoMetadataInput;

      expect(() => buildPhotoMetadata(invalid)).toThrow(/category/);
    });

    it('rejects coordinates outside Milan, naming the field', () => {
      expect(() =>
        buildPhotoMetadata(metadata({ coordinates: { latitude: 41.9, longitude: 12.5 } })),
      ).toThrow(/coordinates\.latitude/);
    });

    it('rejects a too short description, naming the field', () => {
      expect(() => buildPhotoMetadata(metadata({ description: 'corto' }))).toThrow(/description/);
    });

    it('rejects a malformed ID, naming the field', () => {
      expect(() => buildPhotoMetadata(metadata({ id: 'foto-1' }))).toThrow(/id/);
    });

    it('rejects an image file without a valid extension', () => {
      expect(() => buildPhotoMetadata(metadata({ imageFile: 'foto.gif' }))).toThrow(/imageFile/);
    });

    it('reports every invalid field at once', () => {
      const invalid = {
        ...metadata(),
        category: 'disastrato',
        description: 'corto',
      } as unknown as PhotoMetadataInput;

      let message = '';
      try {
        buildPhotoMetadata(invalid);
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }

      expect(message).toMatch(/category/);
      expect(message).toMatch(/description/);
    });
  });

  describe('Importing the ingest module', () => {
    it('does not start an interactive session on import', async () => {
      // The CLI entry is guarded: importing must not read stdin or exit.
      const module = await import('./ingest');

      expect(module).toBeDefined();
    });
  });
});
