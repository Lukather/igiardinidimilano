import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { allocatePhotoId } from './photo-id';
import { idSchema } from '../types/schemas';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp', 'photo-id');
const METADATA_DIR = path.join(TEST_DIR, 'photos');
const PHOTO_DIR = path.join(TEST_DIR, 'images');

const DATE = '2024-01-15';
const SPACE = 'Parco Sempione';

function allocate(date = DATE, space = SPACE) {
  return allocatePhotoId({ date, space, metadataDir: METADATA_DIR, photoDir: PHOTO_DIR });
}

/** Publish a photo the way the ingest does: metadata file plus image file. */
function publish(id: string, content = 'photo content'): void {
  fs.writeFileSync(path.join(METADATA_DIR, `${id}.json`), JSON.stringify({ id }));
  fs.writeFileSync(path.join(PHOTO_DIR, `${id}.jpg`), content);
}

describe('allocatePhotoId', () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  describe('First photo of a space', () => {
    it('allocates index 01', () => {
      const allocation = allocate();

      expect(allocation.id).toBe('2024-01-15-parco-sempione-01');
      expect(allocation.index).toBe(1);
    });

    it('returns paths that match the allocated ID', () => {
      const allocation = allocate();

      expect(allocation.imageFile).toBe('2024-01-15-parco-sempione-01.jpg');
      expect(allocation.metadataPath).toBe(
        path.join(METADATA_DIR, '2024-01-15-parco-sempione-01.json'),
      );
      expect(allocation.imagePath).toBe(
        path.join(PHOTO_DIR, '2024-01-15-parco-sempione-01.jpg'),
      );
    });

    it('produces an ID that passes the schema', () => {
      expect(idSchema.safeParse(allocate().id).success).toBe(true);
    });

    it('works when the output directories do not exist yet', () => {
      fs.rmSync(PHOTO_DIR, { recursive: true, force: true });
      fs.rmSync(METADATA_DIR, { recursive: true, force: true });

      expect(allocate().index).toBe(1);
    });
  });

  describe('Same date and same space', () => {
    it('allocates a distinct index for the second photo', () => {
      publish(allocate().id);

      const second = allocate();

      expect(second.id).toBe('2024-01-15-parco-sempione-02');
      expect(second.index).toBe(2);
    });

    it('leaves the first photo untouched', () => {
      const first = allocate();
      publish(first.id, 'first photo');

      allocate();

      expect(fs.readFileSync(path.join(PHOTO_DIR, `${first.id}.jpg`), 'utf-8')).toBe('first photo');
      expect(fs.existsSync(path.join(METADATA_DIR, `${first.id}.json`))).toBe(true);
    });

    it('keeps allocating distinct IDs for repeated publishes', () => {
      const ids: string[] = [];

      // Publish, then allocate again: allocation only reserves a slot once the
      // photo is actually written.
      for (let i = 0; i < 3; i++) {
        const { id } = allocate();
        ids.push(id);
        publish(id);
      }

      expect(ids).toEqual([
        '2024-01-15-parco-sempione-01',
        '2024-01-15-parco-sempione-02',
        '2024-01-15-parco-sempione-03',
      ]);
      expect(fs.readdirSync(METADATA_DIR)).toHaveLength(3);
      expect(fs.readdirSync(PHOTO_DIR)).toHaveLength(3);
    });

    it('fills the first gap instead of appending at the end', () => {
      publish('2024-01-15-parco-sempione-01');
      publish('2024-01-15-parco-sempione-03');

      expect(allocate().id).toBe('2024-01-15-parco-sempione-02');
    });
  });

  describe('Occupied slots', () => {
    it('treats a metadata file without an image as occupied', () => {
      fs.writeFileSync(path.join(METADATA_DIR, '2024-01-15-parco-sempione-01.json'), '{}');

      expect(allocate().index).toBe(2);
    });

    it('treats an image without metadata as occupied', () => {
      fs.writeFileSync(path.join(PHOTO_DIR, '2024-01-15-parco-sempione-01.jpg'), 'x');

      expect(allocate().index).toBe(2);
    });

    it('treats an image with any extension as occupied', () => {
      fs.writeFileSync(path.join(PHOTO_DIR, '2024-01-15-parco-sempione-01.png'), 'x');

      expect(allocate().index).toBe(2);
    });

    it('ignores files that only share the ID prefix', () => {
      fs.writeFileSync(path.join(PHOTO_DIR, '2024-01-15-parco-sempione-010.jpg'), 'x');

      expect(allocate().index).toBe(1);
    });
  });

  describe('Different photos', () => {
    it('allocates index 01 for a different space on the same date', () => {
      publish(allocate().id);

      expect(allocate(DATE, 'Parco Vecchio').id).toBe('2024-01-15-parco-vecchio-01');
    });

    it('allocates index 01 for the same space on a different date', () => {
      publish(allocate().id);

      expect(allocate('2024-02-20', SPACE).id).toBe('2024-02-20-parco-sempione-01');
    });

    it('treats spaces that slugify identically as the same space', () => {
      publish(allocate(DATE, 'Parco Sempione').id);

      expect(allocate(DATE, 'parco  sempione!').index).toBe(2);
    });
  });

  describe('Exhaustion', () => {
    it('refuses to allocate when every index is taken', () => {
      for (let index = 1; index <= 99; index++) {
        publish(`2024-01-15-parco-sempione-${String(index).padStart(2, '0')}`);
      }

      expect(() => allocate()).toThrow(/all indexes 01-99 are taken/);
    });
  });
});
