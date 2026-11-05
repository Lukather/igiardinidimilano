/**
 * Build script for I Giardini di Milano
 *
 * Workflow:
 * 1. Scan src/data/photos/ for photo metadata files
 * 2. Validate each photo against the schema
 * 3. Verify referenced image files exist
 * 4. Calculate site statistics
 * 5. Output src/data/photos.json for the frontend
 * 6. Fail with clear errors if validation fails
 *
 * Usage:
 *   npx tsx src/scripts/build.ts
 */

import fs from 'fs';
import path from 'path';
import { validatePhoto } from '../types/schemas';
import { calculateStats, validatePhotoDetailed } from '../types/validation';
import type { Photo, SiteData } from '../types/types';

interface BuildConfig {
  metadataDir: string; // Directory with photo metadata JSON files
  photoDir: string; // Directory with optimized images
  outputFile: string; // Where to write the aggregated data
}

const DEFAULT_CONFIG: BuildConfig = {
  metadataDir: path.join(process.cwd(), 'src', 'data', 'photos'),
  photoDir: path.join(process.cwd(), 'src', 'photos'),
  outputFile: path.join(process.cwd(), 'src', 'data', 'photos.json'),
};

/**
 * Find all photo metadata files
 */
function findPhotoMetadataFiles(metadataDir: string): string[] {
  if (!fs.existsSync(metadataDir)) {
    return [];
  }

  const files = fs.readdirSync(metadataDir);
  return files
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(metadataDir, file));
}

/**
 * Load and parse a photo metadata file
 */
function loadPhotoMetadata(filePath: string): unknown {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Verify that the referenced image file exists
 */
function verifyImageFileExists(
  imageFile: string,
  photoDir: string,
  metadataFile: string,
): boolean {
  const imagePath = path.join(photoDir, imageFile);

  if (!fs.existsSync(imagePath)) {
    throw new Error(
      `Image file not found for ${path.basename(metadataFile)}: expected at ${path.relative(process.cwd(), imagePath)}`,
    );
  }

  return true;
}

/**
 * Validate a single photo
 */
function validateSinglePhoto(
  metadataFile: string,
  photoDir: string,
): { photo: Photo | null; error: string | null } {
  try {
    // Load metadata file
    const metadata = loadPhotoMetadata(metadataFile);

    // Get detailed validation errors for better error reporting
    const validationErrors = validatePhotoDetailed(metadata);
    if (validationErrors.length > 0) {
      return { photo: null, error: validationErrors.join('\n    ') };
    }

    // Validate against schema (should succeed if validatePhotoDetailed passed)
    const photo = validatePhoto(metadata);

    // Verify image file exists
    verifyImageFileExists(photo.imageFile, photoDir, metadataFile);

    return { photo, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { photo: null, error: errorMessage };
  }
}

/**
 * Build site data from photos
 */
async function build(config: BuildConfig = DEFAULT_CONFIG) {
  console.log('🏗️  Building I Giardini di Milano\n');

  // ============================================================================
  // Step 1: Find photo metadata files
  // ============================================================================

  console.log('📂 Scanning for photos...');
  const metadataFiles = findPhotoMetadataFiles(config.metadataDir);

  if (metadataFiles.length === 0) {
    console.log('⚠️  No photos found (metadata directory is empty)');
    console.log(`   Expected metadata in: ${config.metadataDir}`);
    console.log('');
    return;
  }

  console.log(`✅ Found ${metadataFiles.length} photo(s)\n`);

  // ============================================================================
  // Step 2: Validate all photos
  // ============================================================================

  console.log('✓ Validating photos...\n');

  const photos: Photo[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const metadataFile of metadataFiles) {
    const fileName = path.basename(metadataFile);
    const result = validateSinglePhoto(metadataFile, config.photoDir);

    if (result.photo) {
      photos.push(result.photo);
      console.log(`  ✅ ${fileName}`);
    } else {
      errors.push({ file: fileName, error: result.error || 'Unknown error' });
      console.log(`  ❌ ${fileName}`);
    }
  }

  console.log('');

  // ============================================================================
  // Step 3: Report validation errors
  // ============================================================================

  if (errors.length > 0) {
    console.error('❌ Validation failed with errors:\n');

    for (const { file, error } of errors) {
      console.error(`  ${file}:`);
      console.error(`    ${error}\n`);
    }

    console.error(`${errors.length} photo(s) failed validation.`);
    process.exit(1);
  }

  // ============================================================================
  // Step 4: Calculate statistics
  // ============================================================================

  console.log('📊 Calculating statistics...');
  const stats = calculateStats(photos);

  console.log(`  Total photos:    ${stats.totalPhotos}`);
  console.log(`  Curated spaces:  ${stats.curatedSpaces}`);
  console.log(`  Degraded spaces: ${stats.degradedSpaces}`);
  console.log('');

  // ============================================================================
  // Step 5: Create site data structure
  // ============================================================================

  const siteData: SiteData = {
    photos,
    stats,
    lastUpdated: new Date().toISOString(),
  };

  // ============================================================================
  // Step 6: Write output file
  // ============================================================================

  console.log('💾 Writing output...');

  // Ensure output directory exists
  const outputDir = path.dirname(config.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON file
  fs.writeFileSync(config.outputFile, JSON.stringify(siteData, null, 2));

  const outputSize = (fs.statSync(config.outputFile).size / 1024).toFixed(2);
  console.log(`✅ Written to: ${path.relative(process.cwd(), config.outputFile)}`);
  console.log(`   Size: ${outputSize}KB`);
  console.log('');

  // ============================================================================
  // Step 7: Summary
  // ============================================================================

  console.log('✨ Build complete!\n');
  console.log('📄 Summary:');
  console.log(`   Photos:          ${stats.totalPhotos}`);
  console.log(`   Curated spaces:  ${stats.curatedSpaces}`);
  console.log(`   Degraded spaces: ${stats.degradedSpaces}`);
  console.log(`   Built:           ${new Date(siteData.lastUpdated).toLocaleString()}`);
  console.log('');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

build().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
