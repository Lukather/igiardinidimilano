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
