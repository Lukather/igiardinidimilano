/**
 * Photo ingest script for I Giardini di Milano
 *
 * Workflow:
 * 1. Read original photo (outside repo)
 * 2. Extract GPS from EXIF
 * 3. Propose coordinates for manual confirmation
 * 4. Strip all metadata (EXIF, IPTC, XMP)
 * 5. Optimize image (resize, compress)
 * 6. Save optimized image to src/photos/
 * 7. Create metadata file for the photo
 *
 * Usage:
 *   npx tsx src/scripts/ingest.ts /path/to/original/photo.jpg
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { allocatePhotoId } from './photo-id';
import {
  buildPhotoMetadata,
  parseCategoryAnswer,
  parseCoordinatesAnswer,
  parseDateAnswer,
} from './ingest-input';
import type { PhotoCategory } from '../types/types';

interface ExtractedGPS {
  latitude?: number;
  longitude?: number;
  error?: string;
}

interface IngestConfig {
  photoDir: string; // Directory where optimized photos will be stored
  metadataDir: string; // Directory where metadata will be stored
  maxWidth: number; // Maximum image width
  maxHeight: number; // Maximum image height
  quality: number; // JPEG quality (1-100)
  targetSize: number; // Target file size in KB (informational)
}

const DEFAULT_CONFIG: IngestConfig = {
  photoDir: path.join(process.cwd(), 'src', 'photos'),
  metadataDir: path.join(process.cwd(), 'src', 'data', 'photos'),
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 80,
  targetSize: 300,
};

/**
 * Extract GPS coordinates from photo EXIF data
 */
async function extractGPSFromExif(filePath: string): Promise<ExtractedGPS> {
  try {
    const buffer = fs.readFileSync(filePath);
    const tags = ExifReader.load(buffer);

    // Check if GPS tags exist
    if (!tags.GPSLatitude || !tags.GPSLongitude) {
      return { error: 'No GPS data found in photo EXIF' };
    }

    // Parse latitude
    const lat = tags.GPSLatitude.value as unknown as number[];
    const latDecimal = lat[0] + lat[1] / 60 + lat[2] / 3600;
    const latDirectionValue = tags.GPSLatitudeRef?.value as unknown as string[] | undefined;
    const latDirection = latDirectionValue ? latDirectionValue[0] : 'N';
    const latitude = latDirection === 'S' ? -latDecimal : latDecimal;

    // Parse longitude
    const lon = tags.GPSLongitude.value as unknown as number[];
    const lonDecimal = lon[0] + lon[1] / 60 + lon[2] / 3600;
    const lonDirectionValue = tags.GPSLongitudeRef?.value as unknown as string[] | undefined;
    const lonDirection = lonDirectionValue ? lonDirectionValue[0] : 'E';
    const longitude = lonDirection === 'W' ? -lonDecimal : lonDecimal;

    return { latitude, longitude };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to extract GPS from EXIF',
    };
  }
}

/**
 * Read the first value of an EXIF tag.
 *
 * ExifReader returns tag values as arrays of strings, not as plain strings.
 */
function firstTagValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
}

/**
 * Extract the date a photo was taken from its EXIF data.
 *
 * `DateTimeOriginal` is when the shutter fired; `DateTime` can be rewritten
 * by editing software, so it is only a fallback.
 */
export function extractDateFromExif(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const tags = ExifReader.load(buffer);

    const raw =
      firstTagValue(tags.DateTimeOriginal?.value) ?? firstTagValue(tags.DateTime?.value);

    if (!raw) {
      return null;
    }

    // EXIF format is YYYY:MM:DD HH:MM:SS; the site uses YYYY-MM-DD.
    const [date] = raw.split(' ');
    const normalized = date.replace(/:/g, '-');

    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
  } catch (error) {
    console.warn('⚠️  Could not extract date from EXIF:', error);
    return null;
  }
}

/** Asks a question and resolves with the answer. */
type Ask = (question: string) => Promise<string>;

/**
 * Single prompt source for the whole run.
 *
 * Opening one readline interface per question loses buffered input when the
 * previous one closes: the second prompt never receives the answer that was
 * already piped in.
 */
function createPrompter(): { ask: Ask; close: () => void } {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask: (question: string) => new Promise<string>((resolve) => rl.question(question, resolve)),
    close: () => rl.close(),
  };
}

/**
 * Prompt user for coordinate confirmation
 */
async function confirmCoordinates(
  ask: Ask,
  proposedLat: number,
  proposedLon: number,
): Promise<{ latitude: number; longitude: number } | null> {
  console.log('\n📍 Proposed coordinates from EXIF:');
  console.log(`   Latitude:  ${proposedLat.toFixed(6)}`);
  console.log(`   Longitude: ${proposedLon.toFixed(6)}`);
  console.log('');

  const answer = await ask('Accept these coordinates? (y/n, or enter corrected lat,lon): ');

  const coordinates = parseCoordinatesAnswer(answer, {
    latitude: proposedLat,
    longitude: proposedLon,
  });

  if (!coordinates) {
    console.log('❌ Invalid input');
  }

  return coordinates;
}

/**
 * Prompt for photo metadata.
 *
 * `proposedDate` comes from EXIF: pressing Enter accepts it instead of
 * retyping the date the camera already recorded.
 */
async function promptMetadata(
  ask: Ask,
  proposedDate: string | null,
): Promise<{
  date: string;
  category: PhotoCategory;
  space: string;
  description: string;
} | null> {
  console.log('\n📋 Enter photo metadata:\n');

  const dateAnswer = await ask(
    proposedDate ? `Date (YYYY-MM-DD) [${proposedDate}]: ` : 'Date (YYYY-MM-DD): ',
  );
  const parsedDate = parseDateAnswer(dateAnswer, proposedDate);
  if (!parsedDate.ok) {
    console.log(`❌ ${parsedDate.error}`);
    return null;
  }
  const date = parsedDate.date;

  const category = parseCategoryAnswer(await ask('Category (curato/in degrado): '));
  if (!category) {
    console.log('❌ Invalid category');
    return null;
  }

  const space = await ask('Space name (e.g., Parco Sempione): ');
  if (!space.trim()) {
    console.log('❌ Space name is required');
    return null;
  }

  const description = await ask('Description: ');
  if (!description.trim()) {
    console.log('❌ Description is required');
    return null;
  }

  return { date, category, space: space.trim(), description: description.trim() };
}

/**
 * Optimize image: resize and compress
 */
async function optimizeImage(
  inputPath: string,
  outputPath: string,
  config: IngestConfig,
): Promise<{ success: boolean; size: number; error?: string }> {
  try {
    const result = await sharp(inputPath)
      .rotate() // Auto-rotate based on EXIF
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.quality, progressive: true })
      .toFile(outputPath);

    const sizeKB = result.size / 1024;
    return { success: true, size: sizeKB };
  } catch (error) {
    return {
      success: false,
      size: 0,
      error: error instanceof Error ? error.message : 'Failed to optimize image',
    };
  }
}

// Note: metadata stripping happens automatically within optimizeImage() above,
// since sharp drops EXIF/IPTC/XMP by default unless withMetadata() is called.

/**
 * Metadata groups ExifReader can report. `file` is excluded on purpose: it
 * holds structural JPEG properties (dimensions, subsampling, file type) that
 * every image has, and counting those made every clean photo look dirty.
 */
const METADATA_GROUPS = [
  'exif',
  'gps',
  'xmp',
  'iptc',
  'icc',
  'photoshop',
  'thumbnail',
  'makerNotes',
  'mpf',
  'riff',
  'gif',
  'png',
  'pngText',
] as const;

/**
 * Names of the metadata groups still present in an image, empty when the
 * image is clean. Used to verify that publishing stripped everything.
 */
export function findRemainingMetadata(buffer: Buffer): string[] {
  const tags = ExifReader.load(buffer, { expanded: true }) as Record<string, unknown>;

  return METADATA_GROUPS.filter((group) => {
    const value = tags[group];
    return (
      value !== null &&
      typeof value === 'object' &&
      Object.keys(value as Record<string, unknown>).length > 0
    );
  });
}

/**
 * Main ingest workflow
 */
async function ingest(originalPhotoPath: string, config: IngestConfig = DEFAULT_CONFIG) {
  console.log('🌱 I Giardini di Milano — Photo Ingest\n');

  // ============================================================================
  // Step 1: Validate input file
  // ============================================================================

  if (!fs.existsSync(originalPhotoPath)) {
    throw new Error(`File not found: ${originalPhotoPath}`);
  }

  const fileName = path.basename(originalPhotoPath);
  console.log(`📸 Processing: ${fileName}`);

  // ============================================================================
  // Step 2: Extract GPS from EXIF
  // ============================================================================

  console.log('\n🔍 Extracting GPS from EXIF...');
  const gpsData = await extractGPSFromExif(originalPhotoPath);

  if (gpsData.error) {
    console.log(`⚠️  ${gpsData.error}`);
  } else {
    console.log(`✅ GPS found: ${gpsData.latitude?.toFixed(6)}, ${gpsData.longitude?.toFixed(6)}`);
  }

  // ============================================================================
  // Step 3: Confirm coordinates
  // ============================================================================

  // One prompter for the whole run: see createPrompter().
  const prompter = createPrompter();

  let coordinates: { latitude: number; longitude: number } | null = null;

  if (gpsData.latitude && gpsData.longitude) {
    coordinates = await confirmCoordinates(prompter.ask, gpsData.latitude, gpsData.longitude);
  } else {
    console.log('\n📍 No GPS found in EXIF. Enter coordinates manually:');

    const answer = await prompter.ask('Latitude, Longitude: ');
    const parts = answer.split(',');

    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lon = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lon)) {
        coordinates = { latitude: lat, longitude: lon };
      }
    }
  }

  if (!coordinates) {
    prompter.close();
    throw new Error('Coordinates not confirmed');
  }

  // ============================================================================
  // Step 4: Extract date from EXIF
  // ============================================================================

  console.log('\n📅 Extracting date from EXIF...');
  const exifDate = extractDateFromExif(originalPhotoPath);

  if (exifDate) {
    console.log(`✅ Date found: ${exifDate} (proposed, press Enter to accept)`);
  } else {
    console.log('⚠️  No date found in EXIF');
  }

  // ============================================================================
  // Step 5: Prompt for metadata
  // ============================================================================

  const metadata = await promptMetadata(prompter.ask, exifDate);

  // Last interactive step: release stdin before the file work.
  prompter.close();

  if (!metadata) {
    throw new Error('Metadata entry cancelled');
  }

  // ============================================================================
  // Step 6: Generate photo ID
  // ============================================================================

  // Allocate the first free slot: publishing never overwrites an existing
  // photo, even when date and space are identical.
  const allocation = allocatePhotoId({
    date: metadata.date,
    space: metadata.space,
    metadataDir: config.metadataDir,
    photoDir: config.photoDir,
  });

  const photoId = allocation.id;
  const imageFileName = allocation.imageFile;

  console.log(`\n🆔 Photo ID: ${photoId}`);
  if (allocation.index > 1) {
    console.log(
      `   (index ${allocation.index.toString().padStart(2, '0')}: ` +
        'another photo of this space already exists for this date)',
    );
  }

  // Validate against the same schema the build uses *before* touching the
  // disk: an invalid value must not leave a half-published photo behind.
  const photoMetadata = buildPhotoMetadata({
    id: photoId,
    category: metadata.category,
    coordinates: coordinates,
    date: metadata.date,
    description: metadata.description,
    space: metadata.space,
    imageFile: imageFileName,
  });

  // ============================================================================
  // Step 7: Create output directories
  // ============================================================================

  if (!fs.existsSync(config.photoDir)) {
    fs.mkdirSync(config.photoDir, { recursive: true });
  }
  if (!fs.existsSync(config.metadataDir)) {
    fs.mkdirSync(config.metadataDir, { recursive: true });
  }

  // ============================================================================
  // Step 8: Optimize and strip metadata
  // ============================================================================

  console.log('\n⚙️  Optimizing image and stripping metadata...');

  const outputImagePath = allocation.imagePath;
  const optimizeResult = await optimizeImage(originalPhotoPath, outputImagePath, config);

  if (!optimizeResult.success) {
    throw new Error(`Failed to optimize image: ${optimizeResult.error}`);
  }

  console.log(`✅ Image optimized: ${optimizeResult.size.toFixed(2)}KB (target: ~${config.targetSize}KB)`);

  // Verify metadata is stripped
  console.log('\n🔐 Verifying metadata is stripped...');
  const buffer = fs.readFileSync(outputImagePath);

  let remaining: string[] = [];
  try {
    remaining = findRemainingMetadata(buffer);
  } catch {
    remaining = [];
  }

  if (remaining.length > 0) {
    console.log(`⚠️  Warning: image still contains metadata: ${remaining.join(', ')}`);
  } else {
    console.log('✅ No metadata found — photo is clean');
  }

  // ============================================================================
  // Step 9: Save metadata file
  // ============================================================================

  const metadataPath = allocation.metadataPath;
  fs.writeFileSync(metadataPath, JSON.stringify(photoMetadata, null, 2));

  console.log(`\n✅ Metadata saved: ${path.relative(process.cwd(), metadataPath)}`);

  // ============================================================================
  // Step 10: Summary
  // ============================================================================

  console.log('\n✨ Ingest complete!\n');
  console.log('📄 Photo metadata:');
  console.log(`   ID:          ${photoMetadata.id}`);
  console.log(`   Category:    ${photoMetadata.category}`);
  console.log(`   Date:        ${photoMetadata.date}`);
  console.log(`   Space:       ${photoMetadata.space}`);
  console.log(`   Coordinates: ${photoMetadata.coordinates.latitude.toFixed(6)}, ${photoMetadata.coordinates.longitude.toFixed(6)}`);
  console.log(`   Description: ${photoMetadata.description}`);
  console.log('\n📁 Files created:');
  console.log(`   Photo:    ${path.relative(process.cwd(), outputImagePath)}`);
  console.log(`   Metadata: ${path.relative(process.cwd(), metadataPath)}`);
  console.log('');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// Only run when executed directly, so tests can import ingest() without
// starting an interactive session.
const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx src/scripts/ingest.ts /path/to/photo.jpg');
    process.exit(1);
  }

  ingest(args[0]).catch((error) => {
    console.error('❌ Ingest failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
