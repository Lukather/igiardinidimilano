/**
 * The image budget, in one place.
 *
 * Every publishing path (CLI ingest, admin panel) optimizes against this
 * config, and the publication step warns when a published image is over it.
 * The spec calls the budget indicative and adjustable; these are the values
 * actually applied.
 */

export interface ImageBudget {
  /** Longest side, in pixels. */
  maxWidth: number;
  maxHeight: number;
  /** Target file size, in kilobytes. */
  targetSizeKB: number;
  /** Quality tried first. */
  qualityStart: number;
  /**
   * Never compress below this. A smaller file is not worth a visibly degraded
   * photo: when the budget cannot be met within this floor, the publication
   * reports it instead of pushing the quality further down.
   */
  qualityMin: number;
  /** Quality decrement between attempts. */
  qualityStep: number;
  /**
   * Widths tried, in order, when the target cannot be met at `maxWidth` even
   * at `qualityMin`.
   */
  fallbackWidths: number[];
}

export const IMAGE_BUDGET: ImageBudget = {
  maxWidth: 1600,
  maxHeight: 1600,
  targetSizeKB: 300,
  qualityStart: 80,
  qualityMin: 60,
  qualityStep: 5,
  fallbackWidths: [1400, 1200],
};

/** True when a file of `bytes` respects the budget. */
export function isWithinBudget(bytes: number, budget: ImageBudget = IMAGE_BUDGET): boolean {
  return bytes / 1024 <= budget.targetSizeKB;
}

/**
 * What a published photo must look like at minimum.
 *
 * Two placeholder JPEGs (10x10, 269 bytes) sat in the photo directory for
 * months and were the first thing the landing page showed. A documented photo
 * of a park is never that small, so the publication refuses anything below
 * these thresholds instead of trusting that nobody will notice.
 */
export const MIN_PUBLISHED_IMAGE = {
  bytes: 20 * 1024,
  width: 640,
  height: 480,
} as const;

/** True when the image looks like real content rather than a placeholder. */
export function looksLikeRealPhoto(
  bytes: number,
  width: number,
  height: number,
): boolean {
  return (
    bytes >= MIN_PUBLISHED_IMAGE.bytes &&
    width >= MIN_PUBLISHED_IMAGE.width &&
    height >= MIN_PUBLISHED_IMAGE.height
  );
}
