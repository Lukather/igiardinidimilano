/**
 * Validation utilities for photo data.
 * 
 * These functions are used by the build script to ensure all photos
 * meet the requirements before the site is generated.
 */

import { Photo, PhotoCategory, Coordinates, SiteStats, MILAN_BOUNDS } from './types';
import { safeValidatePhotos } from './schemas';

// ============================================================================
// CATEGORY UTILITIES
// ============================================================================

/** Check if a string is a valid photo category */
export function isValidCategory(category: string): category is PhotoCategory {
  return category === 'curato' || category === 'in degrado';
}

/** Get all valid categories */
export function getValidCategories(): PhotoCategory[] {
  return ['curato', 'in degrado'];
}

// ============================================================================
// COORDINATE UTILITIES
// ============================================================================

/** Check if coordinates are within Milan bounds */
export function isInMilan(coordinates: Coordinates): boolean {
  return (
    coordinates.latitude >= MILAN_BOUNDS.minLatitude &&
    coordinates.latitude <= MILAN_BOUNDS.maxLatitude &&
    coordinates.longitude >= MILAN_BOUNDS.minLongitude &&
    coordinates.longitude <= MILAN_BOUNDS.maxLongitude
  );
}

/** Check if coordinates are valid (not NaN, not Infinity) */
export function isValidCoordinates(coordinates: Coordinates): boolean {
  return (
    !isNaN(coordinates.latitude) &&
    !isNaN(coordinates.longitude) &&
    isFinite(coordinates.latitude) &&
    isFinite(coordinates.longitude)
  );
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/** Check if a date string is valid and in YYYY-MM-DD format */
export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/** Check if a date is plausible (not in the future, not too old) */
export function isPlausibleDate(date: string): boolean {
  const parsed = new Date(date);
  const now = new Date();
  
  // Allow dates from 2000 to today
  const minDate = new Date('2000-01-01');
  return parsed >= minDate && parsed <= now;
}

// ============================================================================
// ID UTILITIES
// ============================================================================

/** Check if an ID is valid */
export function isValidId(id: string): boolean {
  const idRegex = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
  return idRegex.test(id);
}

/** Generate a valid ID from date and space name */
export function generateId(date: string, space: string, index: number = 1): string {
  const datePart = date.replace(/[^0-9]/g, '-');
  const spaceSlug = space
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `${datePart}-${spaceSlug}-${index.toString().padStart(2, '0')}`;
}

// ============================================================================
// PHOTO VALIDATION
// ============================================================================

/**
 * Validate a photo with detailed error messages.
 * Returns an array of error messages, empty if valid.
 */
export function validatePhotoDetailed(photo: unknown): string[] {
  const result = safeValidatePhotos([photo]);
  
  if (result.success) {
    return [];
  }
  
  const errors: string[] = [];
  
  if (result.error) {
    for (const error of result.error.errors) {
      const path = error.path.join('.');
      errors.push(`${path}: ${error.message}`);
    }
  }
  
  return errors;
}

/**
 * Validate all photos and return aggregated errors.
 */
export function validateAllPhotos(photos: unknown[]): {
  valid: Photo[];
  errors: Array<{ index: number; photoId: string; messages: string[] }>;
} {
  const valid: Photo[] = [];
  const errors: Array<{ index: number; photoId: string; messages: string[] }> = [];
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoErrors = validatePhotoDetailed(photo);
    
    if (photoErrors.length === 0) {
      // Type assertion is safe here because we validated
      valid.push(photo as Photo);
    } else {
      const photoId = (photo as any)?.id || `photo-${i}`;
      errors.push({
        index: i,
        photoId,
        messages: photoErrors,
      });
    }
  }
  
  return { valid, errors };
}

// ============================================================================
// STATS CALCULATION
// ============================================================================

/**
 * Calculate site statistics from photos.
 */
export function calculateStats(photos: Photo[]): SiteStats {
  const curatedSpaces = new Set<string>();
  const degradedSpaces = new Set<string>();
  
  for (const photo of photos) {
    if (photo.category === 'curato') {
      curatedSpaces.add(photo.space);
    } else if (photo.category === 'in degrado') {
      degradedSpaces.add(photo.space);
    }
  }
  
  return {
    totalPhotos: photos.length,
    curatedSpaces: curatedSpaces.size,
    degradedSpaces: degradedSpaces.size,
  };
}
