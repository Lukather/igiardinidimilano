/**
 * Photo ID allocation.
 *
 * A photo ID is `YYYY-MM-DD-slug-NN`. The date and the space slug come from
 * the photo; the index disambiguates photos that share both (two shots of the
 * same park on the same day).
 *
 * Publishing must never overwrite an existing photo. Both the CLI ingest and
 * the admin panel write into the same directories, so the allocation lives
 * here, once, and every publishing path goes through it.
 *
 * A slot is considered taken when either the metadata file or the image file
 * exists: a half-written photo (metadata without image, or the reverse) still
 * owns its slot, so a retry can never clobber it.
 */

import fs from 'fs';
import path from 'path';
import { generateId } from '../types/validation';

/** Highest index we are willing to allocate before asking a human to look. */
const MAX_INDEX = 99;

export interface AllocateOptions {
  /** Date of the photo, `YYYY-MM-DD`. */
  date: string;
  /** Human-readable space name, used to build the slug. */
  space: string;
  /** Directory holding the photo metadata files. */
  metadataDir: string;
  /** Directory holding the optimized images. */
  photoDir: string;
}

export interface AllocatedPhotoId {
  /** Allocated ID, e.g. `2024-01-15-parco-sempione-02`. */
  id: string;
  /** Image filename derived from the ID. */
  imageFile: string;
  /** Absolute path where the metadata must be written. */
  metadataPath: string;
  /** Absolute path where the image must be written. */
  imagePath: string;
  /** Allocated index; greater than 1 means the base slot was already taken. */
  index: number;
}

/**
 * True when the slot for `id` is already occupied by a metadata file or an
 * image file, whatever its extension.
 */
function isSlotTaken(id: string, metadataDir: string, photoDir: string): boolean {
  if (fs.existsSync(path.join(metadataDir, `${id}.json`))) {
    return true;
  }

  if (!fs.existsSync(photoDir)) {
    return false;
  }

  // Any extension counts: an image left behind by a failed run still owns the
  // slot.
  return fs
    .readdirSync(photoDir)
    .some((file) => file.slice(0, file.lastIndexOf('.')) === id);
}

/**
 * Allocate the first free ID for a photo, never reusing an occupied slot.
 *
 * Throws when every index up to `MAX_INDEX` is taken, which means the caller
 * is about to create a duplicate of an existing photo and should be told.
 */
export function allocatePhotoId(options: AllocateOptions): AllocatedPhotoId {
  const { date, space, metadataDir, photoDir } = options;

  for (let index = 1; index <= MAX_INDEX; index++) {
    const id = generateId(date, space, index);

    if (isSlotTaken(id, metadataDir, photoDir)) {
      continue;
    }

    return {
      id,
      imageFile: `${id}.jpg`,
      metadataPath: path.join(metadataDir, `${id}.json`),
      imagePath: path.join(photoDir, `${id}.jpg`),
      index,
    };
  }

  throw new Error(
    `No free photo ID for "${space}" on ${date}: all indexes 01-${MAX_INDEX} are taken. ` +
      'This photo already exists — delete the old one first if you meant to replace it.',
  );
}
