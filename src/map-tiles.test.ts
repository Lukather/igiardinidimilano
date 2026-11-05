import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MAP_TILES } from './map-tiles';

const SRC_DIR = path.join(process.cwd(), 'src');

/** Source files that can request tiles at runtime. */
function runtimeSourceFiles(dir: string = SRC_DIR): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...runtimeSourceFiles(fullPath));
      continue;
    }

    // Tests may legitimately mention a forbidden host in an assertion.
    if (entry.name.includes('.test.')) continue;
    if (!/\.(ts|js|mjs|html)$/.test(entry.name)) continue;

    files.push(fullPath);
  }

  return files;
}

describe('Map tiles', () => {
  describe('Provider policy', () => {
    it('does not use the OpenStreetMap tile servers directly', () => {
      expect(MAP_TILES.url).not.toContain('tile.openstreetmap.org');
    });

    it('is not requested from tile.openstreetmap.org anywhere in the source tree', () => {
      // Match the host inside a URL (an actual tile request), not a mention in
      // a comment explaining why it is forbidden.
      const forbiddenUrl = /https?:\/\/[^'"`\s]*tile\.openstreetmap\.org/;

      const offenders = runtimeSourceFiles().filter((file) =>
        forbiddenUrl.test(fs.readFileSync(file, 'utf-8')),
      );

      expect(offenders.map((file) => path.relative(SRC_DIR, file))).toEqual([]);
    });

    it('serves tiles over https', () => {
      expect(MAP_TILES.url.startsWith('https://')).toBe(true);
    });

    it('requires no API key or token in the URL', () => {
      expect(MAP_TILES.url).not.toMatch(/apikey|api_key|access_token|token=/i);
    });

    it('credits OpenStreetMap with a link', () => {
      expect(MAP_TILES.attribution).toContain('OpenStreetMap');
      expect(MAP_TILES.attribution).toContain('https://www.openstreetmap.org/copyright');
    });
  });

  describe('Zoom levels', () => {
    it('stops at the deepest zoom the provider actually serves', () => {
      // The provider returns blank tiles at zoom 19 and deeper (verified
      // against the live server), so going higher would show empty squares.
      expect(MAP_TILES.maxZoom).toBeLessThanOrEqual(18);
    });

    it('has a usable range for exploring the city', () => {
      expect(MAP_TILES.minZoom).toBeLessThan(MAP_TILES.maxZoom);
      expect(MAP_TILES.maxZoom - MAP_TILES.minZoom).toBeGreaterThanOrEqual(5);
    });
  });

  describe('URL template consistency', () => {
    it('declares a subdomain placeholder only when subdomains are configured', () => {
      const usesSubdomains = MAP_TILES.url.includes('{s}');
      expect(usesSubdomains).toBe(Boolean(MAP_TILES.subdomains));
    });

    it('declares the retina placeholder only when retina is enabled', () => {
      expect(MAP_TILES.url.includes('{r}')).toBe(MAP_TILES.detectRetina);
    });

    it('keeps the zoom and coordinate placeholders', () => {
      expect(MAP_TILES.url).toContain('{z}');
      expect(MAP_TILES.url).toContain('{x}');
      expect(MAP_TILES.url).toContain('{y}');
    });
  });

  describe('The admin panel mirrors the same basemap', () => {
    const adminSource = fs.readFileSync(path.join(SRC_DIR, 'admin', 'admin.js'), 'utf-8');

    it('uses the same tile URL as the public site', () => {
      expect(adminSource).toContain(MAP_TILES.url);
    });

    it('uses the same attribution as the public site', () => {
      expect(adminSource).toContain('openstreetmap.org/copyright');
    });

    it('uses the same maximum zoom as the public site', () => {
      expect(adminSource).toContain(`maxZoom: ${MAP_TILES.maxZoom}`);
    });
  });
});
