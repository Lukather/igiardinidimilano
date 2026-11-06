/**
 * Parsing and validation of the answers given during an ingest.
 *
 * Kept free of I/O so the behaviour can be tested without a terminal: the
 * prompts in ingest.ts are thin wrappers around these functions.
 */

import { photoSchema } from '../types/schemas';
import { isValidCategory } from '../types/validation';
import type { Coordinates, Photo, PhotoCategory } from '../types/types';

export type DateAnswer =
  | { ok: true; date: string }
  | { ok: false; error: string };

/**
 * Interpret the answer to the date prompt.
 *
 * An empty answer accepts the date proposed from EXIF, when there is one;
 * otherwise a date has to be typed. Typing a date always overrides the
 * proposal.
 */
export function parseDateAnswer(answer: string, proposed: string | null): DateAnswer {
  const trimmed = answer.trim();

  if (trimmed === '') {
    if (proposed) {
      return { ok: true, date: proposed };
    }
    return { ok: false, error: 'A date is required (YYYY-MM-DD)' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: `Invalid date "${trimmed}": expected YYYY-MM-DD` };
  }

  return { ok: true, date: trimmed };
}

/**
 * Interpret the answer to the category prompt.
 * Returns null when the answer is not one of the known categories.
 */
export function parseCategoryAnswer(answer: string): PhotoCategory | null {
  const trimmed = answer.trim().toLowerCase();

  return isValidCategory(trimmed) ? trimmed : null;
}

/**
 * Interpret the answer to the coordinates prompt.
 *
 * - empty or `y` accepts the coordinates proposed from EXIF
 * - `n` cancels
 * - `lat,lon` overrides them
 */
export function parseCoordinatesAnswer(
  answer: string,
  proposed: Coordinates,
): Coordinates | null {
  const trimmed = answer.trim();

  if (trimmed === '' || trimmed.toLowerCase() === 'y') {
    return proposed;
  }

  if (trimmed.toLowerCase() === 'n') {
    return null;
  }

  const parts = trimmed.split(',');
  if (parts.length === 2) {
    const latitude = parseFloat(parts[0].trim());
    const longitude = parseFloat(parts[1].trim());

    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

export interface PhotoMetadataInput {
  id: string;
  category: PhotoCategory;
  coordinates: Coordinates;
  date: string;
  description: string;
  space: string;
  imageFile: string;
  /** Optional credit. Empty or whitespace-only means "no credit". */
  author?: string;
}

/**
 * Normalise the optional author answer.
 *
 * An empty answer is not a credit: it becomes `undefined`, so the metadata
 * never carries `"author": ""` and the popup never renders an empty line.
 */
export function normalizeAuthor(author: string | undefined): string | undefined {
  const trimmed = author?.trim();

  return trimmed ? trimmed : undefined;
}

/**
 * Build the metadata that will be written to disk, validating it against the
 * same schema the build uses.
 *
 * Throws before anything is written, naming every invalid field, so a typo
 * cannot reach the repo and surface later as a build failure far from its
 * cause.
 */
export function buildPhotoMetadata(input: PhotoMetadataInput): Photo {
  const result = photoSchema.safeParse({
    ...input,
    author: normalizeAuthor(input.author),
  });

  if (!result.success) {
    const details = result.error.errors
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  ');

    throw new Error(`Invalid photo metadata:\n  ${details}`);
  }

  return result.data;
}
