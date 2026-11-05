/**
 * How a photo category is presented.
 *
 * Colour alone must never carry the distinction between `curato` and
 * `in degrado`: a colour-blind visitor, a grayscale print, a screenshot in a
 * newspaper — all would lose it. Each category therefore has a symbol and a
 * border style, and the same pair is used everywhere the category appears
 * (map marker, popup, filter labels).
 */

import type { PhotoCategory } from './types/types';

/** Text symbol per category. Readable in grayscale and in any font. */
export const CATEGORY_SYMBOL: Record<PhotoCategory, string> = {
  curato: '●',
  'in degrado': '▲',
};

/** Label per category, without the symbol. */
export const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  curato: 'Curato',
  'in degrado': 'In degrado',
};

/** CSS modifier per category. */
export const CATEGORY_MODIFIER: Record<PhotoCategory, string> = {
  curato: 'curato',
  'in degrado': 'degraded',
};

/** `● Curato`, `▲ In degrado`. */
export function categoryText(category: PhotoCategory): string {
  return `${CATEGORY_SYMBOL[category]} ${CATEGORY_LABEL[category]}`;
}

/**
 * Markup for the map marker.
 *
 * Static content only: no photo metadata is interpolated here, so the HTML
 * string cannot carry anything that needs escaping. The disc is white with a
 * coloured border; the symbol inside differs per category, and so does the
 * border style (solid vs dashed) — two non-colour channels.
 */
export function markerIconHtml(category: PhotoCategory): string {
  return (
    `<span class="marker__disc marker__disc--${CATEGORY_MODIFIER[category]}">` +
    `<span class="marker__symbol" aria-hidden="true">${CATEGORY_SYMBOL[category]}</span>` +
    '</span>'
  );
}
