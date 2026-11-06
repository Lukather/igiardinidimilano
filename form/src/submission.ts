/**
 * The submission contract: what the form sends, what lands in staging.
 *
 * This is deliberately *not* the published photo metadata. A submission is a
 * proposal: it carries `categoryProposed` and no id or image filename, because
 * those are assigned at publication. The moderation step is where a proposal
 * becomes a published photo.
 *
 * The limits below mirror the published schema (description 10-500, space
 * 1-100, author 1-100, Milan bounds). They are duplicated rather than imported
 * so this deployable does not depend on the site's source tree; a test asserts
 * the two stay in agreement.
 */

import type { ImageType } from './image-type';

export const CATEGORIES = ['curato', 'in degrado'] as const;
export type Category = (typeof CATEGORIES)[number];

export const MILAN_BOUNDS = {
  minLatitude: 45.35,
  maxLatitude: 45.55,
  minLongitude: 8.95,
  maxLongitude: 9.3,
} as const;

export const LIMITS = {
  descriptionMin: 10,
  descriptionMax: 500,
  spaceMax: 100,
  authorMax: 100,
} as const;

export interface SubmissionFields {
  categoryProposed: Category;
  coordinates: { latitude: number; longitude: number };
  date: string;
  space: string;
  description: string;
  author?: string;
}

export interface Submission extends SubmissionFields {
  id: string;
  receivedAt: string;
  originalBytes: number;
  originalType: ImageType;
}

export type FieldResult =
  | { ok: true; fields: SubmissionFields }
  | { ok: false; field: string; error: string };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read and validate the form fields.
 *
 * Returns the first problem with the name of the field, so the form can point
 * at the input that needs fixing instead of showing a generic error.
 */
export function readSubmissionFields(form: FormData): FieldResult {
  const category = text(form, 'category');
  if (!CATEGORIES.includes(category as Category)) {
    return { ok: false, field: 'category', error: 'Scegli se lo spazio è curato o in degrado' };
  }

  const latitude = Number(text(form, 'latitude'));
  const longitude = Number(text(form, 'longitude'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, field: 'coordinates', error: 'Posiziona la foto sulla mappa' };
  }
  if (
    latitude < MILAN_BOUNDS.minLatitude ||
    latitude > MILAN_BOUNDS.maxLatitude ||
    longitude < MILAN_BOUNDS.minLongitude ||
    longitude > MILAN_BOUNDS.maxLongitude
  ) {
    return { ok: false, field: 'coordinates', error: 'La posizione è fuori da Milano' };
  }

  const date = text(form, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
    return { ok: false, field: 'date', error: 'Indica la data in cui hai scattato la foto' };
  }

  const space = text(form, 'space');
  if (!space || space.length > LIMITS.spaceMax) {
    return { ok: false, field: 'space', error: `Indica il nome dello spazio (max ${LIMITS.spaceMax} caratteri)` };
  }

  const description = text(form, 'description');
  if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
    return {
      ok: false,
      field: 'description',
      error: `Descrivi cosa si vede, da ${LIMITS.descriptionMin} a ${LIMITS.descriptionMax} caratteri`,
    };
  }

  const author = text(form, 'author');
  if (author.length > LIMITS.authorMax) {
    return { ok: false, field: 'author', error: `Il nome può avere al massimo ${LIMITS.authorMax} caratteri` };
  }

  const fields: SubmissionFields = {
    categoryProposed: category as Category,
    coordinates: { latitude, longitude },
    date,
    space,
    description,
  };

  // Absent, never an empty string: a blank credit is not a credit.
  if (author) {
    fields.author = author;
  }

  return { ok: true, fields };
}

/**
 * A submission id: sortable by time, unique per submission.
 *
 * Generated on the server. The client never chooses it, so two submissions
 * cannot collide by accident or on purpose.
 */
export function newSubmissionId(now: Date, random: () => string): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${random()}`;
}

/** Sixteen hex characters of randomness, enough to make collisions negligible. */
export function randomSuffix(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSubmission(input: {
  id: string;
  receivedAt: string;
  fields: SubmissionFields;
  originalBytes: number;
  originalType: ImageType;
}): Submission {
  const { id, receivedAt, fields, originalBytes, originalType } = input;

  const submission: Submission = {
    id,
    receivedAt,
    categoryProposed: fields.categoryProposed,
    coordinates: fields.coordinates,
    date: fields.date,
    space: fields.space,
    description: fields.description,
    originalBytes,
    originalType,
  };

  if (fields.author) {
    submission.author = fields.author;
  }

  return submission;
}
