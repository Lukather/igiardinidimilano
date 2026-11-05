/**
 * Photo popup content for the map.
 *
 * The popup is built as DOM nodes, never as an HTML string: every value that
 * comes from the photo metadata is assigned through `textContent` or an
 * attribute, so a description containing `<`, `>` or quotes is displayed
 * literally instead of being parsed as markup.
 *
 * Building the element here (rather than inline in the map code) keeps the
 * rendering testable without a browser.
 */

import type { Photo } from './types/types';
import { CATEGORY_MODIFIER, categoryText } from './category';

/**
 * Format a `YYYY-MM-DD` date for display.
 *
 * The date is parsed as a calendar date in local time: `new Date('2024-01-15')`
 * is parsed as UTC midnight and would render as the previous day in negative
 * offsets.
 */
export function formatPhotoDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  if (!year || !month || !day) {
    return date;
  }

  return new Date(year, month - 1, day).toLocaleDateString('it-IT');
}

/** Coordinates shown under the description, four decimals is ~11m. */
export function formatCoordinates(photo: Photo): string {
  return `${photo.coordinates.latitude.toFixed(4)}, ${photo.coordinates.longitude.toFixed(4)}`;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

/**
 * Build the popup content for a photo: space, category, image, description,
 * date and coordinates.
 */
export function createPopupElement(photo: Photo): HTMLElement {
  const root = element('div', 'photo-popup');

  // Same symbol as the marker, so the popup confirms which marker was opened
  // without relying on colour.
  const header = element('div', 'photo-popup-header');
  header.append(
    element('strong', undefined, photo.space),
    element(
      'span',
      `photo-popup-category photo-popup-category--${CATEGORY_MODIFIER[photo.category]}`,
      categoryText(photo.category),
    ),
  );

  const image = element('img');
  image.src = `./photos/${photo.imageFile}`;
  image.alt = photo.description;
  image.style.width = '100%';
  image.style.maxWidth = '300px';
  image.style.borderRadius = '6px';
  image.style.margin = '8px 0';

  const description = element('p', 'photo-popup-description', photo.description);

  const meta = element('p', 'photo-popup-meta');
  meta.append(
    element('span', 'photo-popup-date', formatPhotoDate(photo.date)),
    element('span', 'photo-popup-coords', formatCoordinates(photo)),
  );

  root.append(header, image, description, meta);

  return root;
}
