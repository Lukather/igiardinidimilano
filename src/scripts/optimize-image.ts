/**
 * Image optimization for publication.
 *
 * Resizes to the budget's longest side and compresses until the file fits the
 * target size, without ever going below the declared quality floor. When the
 * target cannot be met within that floor, the smallest acceptable attempt is
 * written and the caller is told, so the publication can say so explicitly
 * instead of silently shipping a heavy file or a degraded photo.
 *
 * sharp drops EXIF/IPTC/XMP unless `withMetadata()` is called, so the output
 * carries no metadata: the only geolocation that reaches the site is the one
 * confirmed by hand in the photo metadata.
 */

import fs from 'fs';
import sharp from 'sharp';
import { IMAGE_BUDGET, type ImageBudget } from './image-budget';

export interface OptimizeResult {
  /** Size of the written file, in kilobytes. */
  sizeKB: number;
  /** Quality actually used. */
  quality: number;
  /** Longest side actually used. */
  width: number;
  /** Height of the written image, in pixels. */
  height: number;
  /** False when the target size could not be met at or above the quality floor. */
  withinBudget: boolean;
}

/** Quality values to try, from the best to the floor. */
function qualitySteps(budget: ImageBudget): number[] {
  const steps: number[] = [];

  for (let quality = budget.qualityStart; quality >= budget.qualityMin; quality -= budget.qualityStep) {
    steps.push(quality);
  }

  // Always include the floor itself, even when the step does not land on it.
  if (steps[steps.length - 1] !== budget.qualityMin) {
    steps.push(budget.qualityMin);
  }

  return steps;
}

/**
 * Optimize `input` (a path or an in-memory buffer) into `outputPath` against
 * the budget.
 *
 * Strategy: keep the resolution and lower the quality first; only reduce the
 * resolution when even the quality floor at full size is not enough.
 */
export async function optimizeImage(
  input: string | Buffer,
  outputPath: string,
  budget: ImageBudget = IMAGE_BUDGET,
): Promise<OptimizeResult> {
  const widths = [budget.maxWidth, ...budget.fallbackWidths];
  const qualities = qualitySteps(budget);

  let smallest: { buffer: Buffer; sizeKB: number; quality: number; width: number } | null = null;

  for (const width of widths) {
    for (const quality of qualities) {
      const buffer = await sharp(input)
        .rotate() // Auto-rotate based on EXIF
        .resize(width, budget.maxHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, progressive: true })
        .toBuffer();

      const sizeKB = buffer.length / 1024;

      if (!smallest || sizeKB < smallest.sizeKB) {
        smallest = { buffer, sizeKB, quality, width };
      }

      if (sizeKB <= budget.targetSizeKB) {
        return write(outputPath, buffer, sizeKB, quality, width, true);
      }
    }
  }

  // Nothing fit: publish the smallest attempt that respects the quality floor.
  const best = smallest!;

  return write(outputPath, best.buffer, best.sizeKB, best.quality, best.width, false);
}

async function write(
  outputPath: string,
  buffer: Buffer,
  sizeKB: number,
  quality: number,
  width: number,
  withinBudget: boolean,
): Promise<OptimizeResult> {
  fs.writeFileSync(outputPath, buffer);

  const metadata = await sharp(buffer).metadata();

  return {
    sizeKB,
    quality,
    width,
    height: metadata.height ?? 0,
    withinBudget,
  };
}
