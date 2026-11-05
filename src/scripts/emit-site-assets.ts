/**
 * Emit the site assets into the static build output.
 *
 * The published site is self-contained: it fetches `./data/photos.json` and
 * `./photos/{imageFile}` at runtime, so both must exist inside the build
 * output. Vite only emits the HTML/CSS/JS bundle, therefore this step copies
 * the generated data and the referenced images into the output directory.
 *
 * Contract between the two build steps:
 * - `build:data` generates `src/data/photos.json` from the photo metadata.
 * - `build:site` (Vite) copies that file and the images it references into
 *   the output directory, then fails loudly if anything is missing.
 *
 * Only images referenced by the metadata are copied: unreferenced files in the
 * photo directory are never published.
 *
 * This is also the last gate before publishing: an image that still carries
 * EXIF, GPS, XMP or ICC metadata stops the build. The ingest strips metadata
 * with sharp, but nothing else prevents an unstripped JPEG from being dropped
 * into the photo directory by hand — and that would publish the photographer's
 * GPS coordinates.
 */

import fs from 'fs';
import path from 'path';
import { findRemainingMetadata } from './image-metadata';
import { IMAGE_BUDGET, isWithinBudget } from './image-budget';

export interface EmitConfig {
  /** Aggregated site data produced by the data build. */
  dataFile: string;
  /** Directory holding the optimized photos. */
  photoDir: string;
  /** Static build output directory. */
  outDir: string;
}

export interface EmitResult {
  /** Number of photos referenced by the data. */
  photos: number;
  /** Number of image files copied into the output. */
  images: number;
  /** Absolute path of the copied data file. */
  dataFile: string;
  /** Images published above the size budget. */
  overBudget: string[];
}

interface SiteDataShape {
  photos?: Array<{ imageFile?: unknown }>;
}

/**
 * Read the aggregated data and return the photo count plus the image
 * filenames it references (deduplicated).
 */
function readReferencedImages(dataFile: string): { photoCount: number; imageFiles: string[] } {
  if (!fs.existsSync(dataFile)) {
    throw new Error(
      `Site data not found at ${path.relative(process.cwd(), dataFile)}. ` +
        'Run "npm run build:data" before building the site.',
    );
  }

  let parsed: SiteDataShape;
  try {
    parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as SiteDataShape;
  } catch (error) {
    throw new Error(
      `Site data is not valid JSON (${path.relative(process.cwd(), dataFile)}): ` +
        (error instanceof Error ? error.message : 'unknown error'),
    );
  }

  if (!parsed || !Array.isArray(parsed.photos)) {
    throw new Error(
      `Site data has an unexpected shape (${path.relative(process.cwd(), dataFile)}): ` +
        'expected an object with a "photos" array.',
    );
  }

  const filenames: string[] = [];
  for (const photo of parsed.photos) {
    const imageFile = photo?.imageFile;
    if (typeof imageFile !== 'string' || imageFile.length === 0) {
      throw new Error(
        `Site data contains a photo without a valid "imageFile" (${path.relative(process.cwd(), dataFile)}).`,
      );
    }
    if (!filenames.includes(imageFile)) {
      filenames.push(imageFile);
    }
  }

  return { photoCount: parsed.photos.length, imageFiles: filenames };
}

/**
 * Copy the site data and every referenced image into the build output.
 *
 * Throws with an actionable message when the data is missing or when a
 * referenced image does not exist on disk, so a broken site never ships.
 */
export function emitSiteAssets(config: EmitConfig): EmitResult {
  const { photoCount, imageFiles } = readReferencedImages(config.dataFile);

  const missing = imageFiles.filter(
    (imageFile) => !fs.existsSync(path.join(config.photoDir, imageFile)),
  );

  if (missing.length > 0) {
    throw new Error(
      `Site data references ${missing.length} image(s) that do not exist in ` +
        `${path.relative(process.cwd(), config.photoDir)}:\n` +
        missing.map((imageFile) => `  - ${imageFile}`).join('\n'),
    );
  }

  const unreadable: string[] = [];
  const withMetadata: Array<{ imageFile: string; groups: string[] }> = [];

  for (const imageFile of imageFiles) {
    const buffer = fs.readFileSync(path.join(config.photoDir, imageFile));

    try {
      const groups = findRemainingMetadata(buffer);
      if (groups.length > 0) {
        withMetadata.push({ imageFile, groups });
      }
    } catch {
      // Not a readable image: publishing it would ship a broken file.
      unreadable.push(imageFile);
    }
  }

  if (withMetadata.length > 0 || unreadable.length > 0) {
    const lines = [
      ...withMetadata.map(({ imageFile, groups }) => `  - ${imageFile}: ${groups.join(', ')}`),
      ...unreadable.map((imageFile) => `  - ${imageFile}: not a readable image`),
    ];

    throw new Error(
      `${lines.length} image(s) cannot be published:\n${lines.join('\n')}\n` +
        'Re-ingest them with "npm run ingest" to strip the metadata.',
    );
  }

  const outDataDir = path.join(config.outDir, 'data');
  const outPhotoDir = path.join(config.outDir, 'photos');
  fs.mkdirSync(outDataDir, { recursive: true });
  fs.mkdirSync(outPhotoDir, { recursive: true });

  const outDataFile = path.join(outDataDir, path.basename(config.dataFile));
  fs.copyFileSync(config.dataFile, outDataFile);

  const overBudget: Array<{ imageFile: string; sizeKB: number }> = [];

  for (const imageFile of imageFiles) {
    const source = path.join(config.photoDir, imageFile);
    fs.copyFileSync(source, path.join(outPhotoDir, imageFile));

    const bytes = fs.statSync(source).size;
    if (!isWithinBudget(bytes)) {
      overBudget.push({ imageFile, sizeKB: bytes / 1024 });
    }
  }

  // The budget is indicative, not a hard limit: report it instead of failing.
  if (overBudget.length > 0) {
    console.warn(
      `⚠️  ${overBudget.length} published image(s) over the ${IMAGE_BUDGET.targetSizeKB}KB budget:\n` +
        overBudget
          .map(({ imageFile, sizeKB }) => `  - ${imageFile}: ${sizeKB.toFixed(0)}KB`)
          .join('\n') +
        '\nRe-ingest them from the original to bring them back within budget.',
    );
  }

  // Verify what we just wrote: a missing file here means the published site
  // would 404 at runtime.
  const unverified = [
    outDataFile,
    ...imageFiles.map((imageFile) => path.join(outPhotoDir, imageFile)),
  ].filter((filePath) => !fs.existsSync(filePath));

  if (unverified.length > 0) {
    throw new Error(
      `Site assets were not written to the build output:\n` +
        unverified.map((filePath) => `  - ${path.relative(process.cwd(), filePath)}`).join('\n'),
    );
  }

  return {
    photos: photoCount,
    images: imageFiles.length,
    dataFile: outDataFile,
    overBudget: overBudget.map(({ imageFile }) => imageFile),
  };
}
