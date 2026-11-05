import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CATEGORY_LABEL,
  CATEGORY_MODIFIER,
  CATEGORY_SYMBOL,
  categoryText,
  markerIconHtml,
} from './category';
import { PHOTO_CATEGORIES } from './types/types';

const CATEGORIES = PHOTO_CATEGORIES;

describe('Category presentation', () => {
  describe('The distinction never relies on colour alone', () => {
    it('gives each category a different symbol', () => {
      const symbols = CATEGORIES.map((category) => CATEGORY_SYMBOL[category]);

      expect(symbols[0]).not.toBe(symbols[1]);
      expect(new Set(symbols).size).toBe(CATEGORIES.length);
    });

    it('gives each category a different label', () => {
      const labels = CATEGORIES.map((category) => CATEGORY_LABEL[category]);

      expect(new Set(labels).size).toBe(CATEGORIES.length);
    });

    it('uses a different border style per category', () => {
      const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles', 'main.css'), 'utf-8');

      expect(css).toMatch(/\.marker__disc--curato\s*\{[^}]*border:\s*3px solid/);
      expect(css).toMatch(/\.marker__disc--degraded\s*\{[^}]*border:\s*3px dashed/);
    });
  });

  describe('Marker markup', () => {
    it('contains the category symbol', () => {
      for (const category of CATEGORIES) {
        expect(markerIconHtml(category)).toContain(CATEGORY_SYMBOL[category]);
      }
    });

    it('carries the category modifier class', () => {
      for (const category of CATEGORIES) {
        expect(markerIconHtml(category)).toContain(`marker__disc--${CATEGORY_MODIFIER[category]}`);
      }
    });

    it('produces different markup per category', () => {
      expect(markerIconHtml('curato')).not.toBe(markerIconHtml('in degrado'));
    });

    it('hides the decorative symbol from screen readers', () => {
      // The category is announced as text in the popup, so the glyph inside the
      // marker is decoration.
      for (const category of CATEGORIES) {
        expect(markerIconHtml(category)).toContain('aria-hidden="true"');
      }
    });

    it('interpolates nothing but the category', () => {
      // Static markup: no photo metadata reaches this string, so there is
      // nothing here that could need escaping.
      for (const category of CATEGORIES) {
        expect(markerIconHtml(category)).not.toMatch(/[<>]script|onerror|onload/i);
      }
    });
  });

  describe('Text', () => {
    it('combines symbol and label', () => {
      expect(categoryText('curato')).toBe('● Curato');
      expect(categoryText('in degrado')).toBe('▲ In degrado');
    });
  });

  describe('The filter labels in the landing page agree with the markers', () => {
    const landing = fs.readFileSync(path.join(process.cwd(), 'src', 'index.html'), 'utf-8');

    it('uses the same symbol and label for each category', () => {
      for (const category of CATEGORIES) {
        expect(landing).toContain(
          `<span class="filter-text ${CATEGORY_MODIFIER[category]}">${categoryText(category)}</span>`,
        );
      }
    });
  });
});
