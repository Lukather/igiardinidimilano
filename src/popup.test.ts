// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createPopupElement, formatPhotoDate, formatCoordinates } from './popup';
import type { Photo } from './types/types';
import { categoryText } from './category';

function photo(overrides: Partial<Photo> = {}): Photo {
  return {
    id: '2024-01-15-parco-sempione-01',
    category: 'curato',
    coordinates: { latitude: 45.4719, longitude: 9.1738 },
    date: '2024-01-15',
    description: 'Parco ben mantenuto, prato verde e attrezzature funzionanti',
    space: 'Parco Sempione',
    imageFile: '2024-01-15-parco-sempione-01.jpg',
    ...overrides,
  };
}

describe('Photo popup', () => {
  describe('Content', () => {
    it('shows the space name', () => {
      const popup = createPopupElement(photo());

      expect(popup.querySelector('.photo-popup-header strong')?.textContent).toBe('Parco Sempione');
    });

    it('shows the category as text, not only as a colour', () => {
      const curated = createPopupElement(photo({ category: 'curato' }));
      const degraded = createPopupElement(photo({ category: 'in degrado' }));

      // Same symbol and label as the map marker: the popup confirms which
      // marker was opened without relying on colour.
      expect(curated.querySelector('.photo-popup-category')?.textContent).toBe('● Curato');
      expect(degraded.querySelector('.photo-popup-category')?.textContent).toBe('▲ In degrado');
    });

    it('uses the same symbol as the marker for each category', () => {
      for (const category of ['curato', 'in degrado'] as const) {
        const popup = createPopupElement(photo({ category }));

        expect(popup.querySelector('.photo-popup-category')?.textContent).toBe(
          categoryText(category),
        );
      }
    });

    it('shows the photo with an accessible alt text', () => {
      const popup = createPopupElement(photo());
      const image = popup.querySelector('img');

      expect(image?.getAttribute('src')).toBe('./photos/2024-01-15-parco-sempione-01.jpg');
      expect(image?.getAttribute('alt')).toBe(
        'Parco ben mantenuto, prato verde e attrezzature funzionanti',
      );
    });

    it('shows the description', () => {
      const popup = createPopupElement(photo());

      expect(popup.querySelector('.photo-popup-description')?.textContent).toBe(
        'Parco ben mantenuto, prato verde e attrezzature funzionanti',
      );
    });

    it('shows the date in Italian format', () => {
      const popup = createPopupElement(photo());

      expect(popup.querySelector('.photo-popup-date')?.textContent).toBe('15/01/2024');
    });

    it('shows the coordinates', () => {
      const popup = createPopupElement(photo());

      expect(popup.querySelector('.photo-popup-coords')?.textContent).toBe('45.4719, 9.1738');
    });
  });

  describe('Optional author credit', () => {
    it('shows the credit when the photo carries an author', () => {
      const popup = createPopupElement(photo({ author: 'Lorenzo' }));

      expect(popup.querySelector('.photo-popup-author')?.textContent).toBe('Foto di Lorenzo');
    });

    it('shows no credit line when the photo has no author', () => {
      const popup = createPopupElement(photo());

      // Not an empty line: that would read as a missing name rather than as
      // no per-photo credit, which is the normal case.
      expect(popup.querySelector('.photo-popup-author')).toBeNull();
    });

    it('renders a hostile author literally', () => {
      const popup = createPopupElement(photo({ author: '<img src=x onerror=alert(1)>' }));
      const credit = popup.querySelector('.photo-popup-author');

      expect(credit?.textContent).toBe('Foto di <img src=x onerror=alert(1)>');
      expect(credit?.querySelector('img')).toBeNull();
    });
  });

  describe('Metadata containing markup', () => {
    const hostile = '<script>alert("x")</script> & "virgolette" \'apici\'';

    it('renders the description literally', () => {
      const popup = createPopupElement(photo({ description: hostile }));

      expect(popup.querySelector('.photo-popup-description')?.textContent).toBe(hostile);
    });

    it('does not create elements from the description', () => {
      const popup = createPopupElement(photo({ description: hostile }));

      expect(popup.querySelector('script')).toBeNull();
      expect(popup.querySelectorAll('.photo-popup-description *')).toHaveLength(0);
    });

    it('escapes the description in the serialised markup', () => {
      const popup = createPopupElement(photo({ description: hostile }));
      const descriptionMarkup = popup.querySelector('.photo-popup-description')?.innerHTML ?? '';

      expect(descriptionMarkup).not.toContain('<script>');
      expect(descriptionMarkup).toContain('&lt;script&gt;');
      expect(descriptionMarkup).toContain('&amp;');
    });

    it('renders a hostile space name literally', () => {
      const popup = createPopupElement(photo({ space: '<b>Parco</b> & "Co"' }));

      expect(popup.querySelector('.photo-popup-header strong')?.textContent).toBe(
        '<b>Parco</b> & "Co"',
      );
      expect(popup.querySelector('.photo-popup-header b')).toBeNull();
    });

    it('treats a hostile description as an attribute value, not as markup', () => {
      const popup = createPopupElement(photo({ description: hostile }));
      const image = popup.querySelector('img');

      // The raw string is kept as an attribute value; nothing is parsed.
      expect(image?.getAttribute('alt')).toBe(hostile);
      expect(image?.childElementCount).toBe(0);
      expect(popup.querySelector('script')).toBeNull();
    });

    it('keeps quotes in the image src attribute from breaking out', () => {
      const popup = createPopupElement(photo({ imageFile: 'x" onerror="alert(1).jpg' }));
      const image = popup.querySelector('img');

      expect(image?.getAttribute('onerror')).toBeNull();
      expect(image?.getAttribute('src')).toBe('./photos/x" onerror="alert(1).jpg');
    });
  });

  describe('formatPhotoDate', () => {
    it('formats a calendar date without shifting the day', () => {
      expect(formatPhotoDate('2024-01-01')).toBe('01/01/2024');
      expect(formatPhotoDate('2024-12-31')).toBe('31/12/2024');
    });

    it('returns the input when the date is not parseable', () => {
      expect(formatPhotoDate('non-una-data')).toBe('non-una-data');
    });
  });

  describe('formatCoordinates', () => {
    it('rounds to four decimals', () => {
      expect(formatCoordinates(photo({ coordinates: { latitude: 45.4958691, longitude: 9.2079575 } })))
        .toBe('45.4959, 9.2080');
    });
  });
});
