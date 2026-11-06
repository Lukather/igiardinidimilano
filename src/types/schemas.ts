/**
 * Validation schemas for I Giardini di Milano data model.
 * 
 * Uses Zod for runtime validation. The build will fail with clear errors
 * if any photo has invalid data.
 */

import { z } from 'zod';
import { MILAN_BOUNDS } from './types';

// ============================================================================
// CATEGORY SCHEMA
// ============================================================================

/** Schema for photo category validation */
export const categorySchema = z.enum(['curato', 'in degrado'] as const);

// ============================================================================
// COORDINATES SCHEMA
// ============================================================================

/** Schema for coordinate validation */
export const coordinatesSchema = z.object({
  latitude: z.number()
    .min(MILAN_BOUNDS.minLatitude, {
      message: `Latitude must be >= ${MILAN_BOUNDS.minLatitude} (Milan bounds)`,
    })
    .max(MILAN_BOUNDS.maxLatitude, {
      message: `Latitude must be <= ${MILAN_BOUNDS.maxLatitude} (Milan bounds)`,
    }),
  longitude: z.number()
    .min(MILAN_BOUNDS.minLongitude, {
      message: `Longitude must be >= ${MILAN_BOUNDS.minLongitude} (Milan bounds)`,
    })
    .max(MILAN_BOUNDS.maxLongitude, {
      message: `Longitude must be <= ${MILAN_BOUNDS.maxLongitude} (Milan bounds)`,
    }),
});

// ============================================================================
// DATE SCHEMA
// ============================================================================

/** Schema for date validation (YYYY-MM-DD format) */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, {
    message: 'Date must be a valid date',
  });

// ============================================================================
// ID SCHEMA
// ============================================================================

/** Schema for photo ID validation */
export const idSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/, {
    message: 'ID must be in YYYY-MM-DD-slug format (e.g., "2024-01-15-parco-sempione-01")',
  });

// ============================================================================
// PHOTO SCHEMA
// ============================================================================

/** Complete schema for photo validation */
export const photoSchema = z.object({
  id: idSchema,
  category: categorySchema,
  coordinates: coordinatesSchema,
  date: dateSchema,
  description: z.string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(500, { message: 'Description must be at most 500 characters' }),
  space: z.string()
    .min(1, { message: 'Space name is required' })
    .max(100, { message: 'Space name must be at most 100 characters' }),
  imageFile: z.string()
    .min(1, { message: 'Image file is required' })
    .regex(/\.(jpg|jpeg|png|webp)$/i, {
      message: 'Image file must have a valid extension (jpg, jpeg, png, webp)',
    }),
  // Optional credit for who took the photo. Absent is the normal case: the
  // site-wide attribution in the footer covers it. When present it must say
  // something, so a blank value is rejected rather than published as a
  // nameless credit.
  author: z.string()
    .trim()
    .min(1, { message: 'Author must not be blank' })
    .max(100, { message: 'Author must be at most 100 characters' })
    .optional(),
});

/** Array schema for validating multiple photos */
export const photosSchema = z.array(photoSchema);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single photo.
 * Returns the validated photo or throws with detailed errors.
 */
export function validatePhoto(photo: unknown): z.infer<typeof photoSchema> {
  return photoSchema.parse(photo);
}

/**
 * Validate multiple photos.
 * Returns the validated photos or throws with detailed errors.
 */
export function validatePhotos(photos: unknown): z.infer<typeof photoSchema>[] {
  return photosSchema.parse(photos);
}

/**
 * Validate and parse a photo, returning validation result with errors if any.
 */
export function safeValidatePhoto(photo: unknown): {
  success: boolean;
  data?: z.infer<typeof photoSchema>;
  error?: z.ZodError;
} {
  const result = photoSchema.safeParse(photo);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate and parse multiple photos, returning validation result with errors if any.
 */
export function safeValidatePhotos(photos: unknown): {
  success: boolean;
  data?: z.infer<typeof photoSchema>[];
  error?: z.ZodError;
} {
  const result = photosSchema.safeParse(photos);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
