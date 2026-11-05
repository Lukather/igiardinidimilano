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
 * Extract date from photo EXIF data
 */
function extractDateFromExif(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const tags = ExifReader.load(buffer);

    if (tags.DateTime) {
      const dateTime = tags.DateTime.value as string;
      // Convert from EXIF format (YYYY:MM:DD HH:MM:SS) to ISO format (YYYY-MM-DD)
      const [date] = dateTime.split(' ');
      return date.replace(/:/g, '-');
    }

    return null;
  } catch (error) {
    console.warn('⚠️  Could not extract date from EXIF:', error);
    return null;
  }
}

/**
 * Prompt user for coordinate confirmation
 */
async function confirmCoordinates(
  proposedLat: number,
  proposedLon: number,
): Promise<{ latitude: number; longitude: number } | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n📍 Proposed coordinates from EXIF:');
    console.log(`   Latitude:  ${proposedLat.toFixed(6)}`);
    console.log(`   Longitude: ${proposedLon.toFixed(6)}`);
    console.log('');

    rl.question(
      'Accept these coordinates? (y/n, or enter corrected lat,lon): ',
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === 'y' || answer === '') {
          resolve({ latitude: proposedLat, longitude: proposedLon });
          return;
        }

        if (answer.toLowerCase() === 'n') {
          resolve(null);
          return;
        }

        // Try to parse corrected coordinates
        const parts = answer.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0].trim());
          const lon = parseFloat(parts[1].trim());
          if (!isNaN(lat) && !isNaN(lon)) {
            resolve({ latitude: lat, longitude: lon });
            return;
          }
        }

        console.log('❌ Invalid input');
        resolve(null);
      },
    );
  });
}

/**
 * Prompt for photo metadata
 */
async function promptMetadata(): Promise<{
  date: string;
  category: string;
  space: string;
  description: string;
} | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    console.log('\n📋 Enter photo metadata:\n');

    const date = await question('Date (YYYY-MM-DD): ');
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('❌ Invalid date format');
      return null;
    }

    const category = await question('Category (curato/in degrado): ');
    if (!['curato', 'in degrado'].includes(category)) {
      console.log('❌ Invalid category');
      return null;
    }

    const space = await question('Space name (e.g., Parco Sempione): ');
    if (!space.trim()) {
      console.log('❌ Space name is required');
      return null;
    }

    const description = await question('Description: ');
    if (!description.trim()) {
      console.log('❌ Description is required');
      return null;
    }

    rl.close();

    return { date, category, space: space.trim(), description: description.trim() };
  } catch (error) {
    rl.close();
    return null;
  }
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
 * Generate photo ID from date and space name
 */
function generatePhotoId(date: string, space: string, index: number = 1): string {
  const datePart = date.replace(/[^0-9]/g, '-');
  const spaceSlug = space
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${datePart}-${spaceSlug}-${index.toString().padStart(2, '0')}`;
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
    console.error(`❌ File not found: ${originalPhotoPath}`);
    process.exit(1);
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

  let coordinates: { latitude: number; longitude: number } | null = null;

  if (gpsData.latitude && gpsData.longitude) {
    coordinates = await confirmCoordinates(gpsData.latitude, gpsData.longitude);
  } else {
    console.log('\n📍 No GPS found in EXIF. Enter coordinates manually:');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Latitude, Longitude: ', resolve);
    });
    rl.close();

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
    console.log('❌ Coordinates not confirmed');
    process.exit(1);
  }

  // ============================================================================
  // Step 4: Extract date from EXIF
  // ============================================================================

  console.log('\n📅 Extracting date from EXIF...');
  let date = extractDateFromExif(originalPhotoPath);

  if (date) {
    console.log(`✅ Date found: ${date}`);
  } else {
    console.log('⚠️  No date found in EXIF');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    date = await new Promise<string>((resolve) => {
      rl.question('Enter date (YYYY-MM-DD): ', resolve);
    });
    rl.close();
  }

  // ============================================================================
  // Step 5: Prompt for metadata
  // ============================================================================

  const metadata = await promptMetadata();
  if (!metadata) {
    console.log('❌ Metadata entry cancelled');
    process.exit(1);
  }

  // ============================================================================
  // Step 6: Generate photo ID
  // ============================================================================

  const photoId = generatePhotoId(metadata.date, metadata.space);
  const imageFileName = `${photoId}.jpg`;

  console.log(`\n🆔 Photo ID: ${photoId}`);

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

  const outputImagePath = path.join(config.photoDir, imageFileName);
  const optimizeResult = await optimizeImage(originalPhotoPath, outputImagePath, config);

  if (!optimizeResult.success) {
    console.error(`❌ Failed to optimize image: ${optimizeResult.error}`);
    process.exit(1);
  }

  console.log(`✅ Image optimized: ${optimizeResult.size.toFixed(2)}KB (target: ~${config.targetSize}KB)`);

  // Verify metadata is stripped
  console.log('\n🔐 Verifying metadata is stripped...');
  const buffer = fs.readFileSync(outputImagePath);
  try {
    const tags = ExifReader.load(buffer);
    const hasMetadata = Object.keys(tags).length > 0;

    if (hasMetadata) {
      console.log(`⚠️  Warning: Image still contains EXIF tags (${Object.keys(tags).length})`);
    } else {
      console.log('✅ No metadata found — photo is clean');
    }
  } catch {
    console.log('✅ No metadata found — photo is clean');
  }

  // ============================================================================
  // Step 9: Save metadata file
  // ============================================================================

  const photoMetadata = {
    id: photoId,
    category: metadata.category,
    coordinates: coordinates,
    date: metadata.date,
    description: metadata.description,
    space: metadata.space,
    imageFile: imageFileName,
  };

  const metadataPath = path.join(config.metadataDir, `${photoId}.json`);
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

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npx tsx src/scripts/ingest.ts /path/to/photo.jpg');
  process.exit(1);
}

const photoPath = args[0];
ingest(photoPath).catch((error) => {
  console.error('❌ Ingest failed:', error);
  process.exit(1);
});
