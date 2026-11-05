import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Landing Page', () => {
  describe('HTML Structure', () => {
    let htmlContent: string;

    beforeAll(() => {
      const htmlPath = path.join(process.cwd(), 'src', 'index.html');
      htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    });

    it('should have correct document type', () => {
      expect(htmlContent).toMatch(/^<!doctype html>/i);
    });

    it('should have Italian language', () => {
      expect(htmlContent).toContain('lang="it"');
    });

    it('should have proper head metadata', () => {
      expect(htmlContent).toContain('<meta charset="utf-8"');
      expect(htmlContent).toContain('viewport');
      expect(htmlContent).toContain('I Giardini di Milano');
    });

    it('should include main TS/JS', () => {
      expect(htmlContent).toContain('./main.ts');
    });

    it('should not load Leaflet from a CDN', () => {
      // Leaflet is a bundled dependency: a second copy from a CDN would
      // download the same library twice.
      expect(htmlContent).not.toContain('unpkg.com');
      expect(htmlContent).not.toContain('leaflet@1.9.4');
      expect(htmlContent).not.toContain('leaflet.js');
      expect(htmlContent).not.toContain('leaflet.css');
    });

    it('should not load any script or stylesheet from an external host', () => {
      // Only resource-loading tags count: outbound links (the licence in the
      // footer) are fine.
      const externalScripts = htmlContent.match(/<script[^>]+src="https?:\/\/[^"]+"/g) ?? [];
      const externalStyles = htmlContent.match(/<link[^>]+href="https?:\/\/[^"]+"/g) ?? [];

      expect([...externalScripts, ...externalStyles]).toEqual([]);
    });

    it('should have hero section', () => {
      expect(htmlContent).toContain('class="hero"');
      expect(htmlContent).toContain('hero-split');
      expect(htmlContent).toContain('hero-half--curato');
      expect(htmlContent).toContain('hero-half--degraded');
    });

    it('should have hero tags', () => {
      expect(htmlContent).toContain('CURATO');
      expect(htmlContent).toContain('IN DEGRADO');
    });

    it('should have hero claim and title', () => {
      expect(htmlContent).toContain('I Giardini di Milano');
      expect(htmlContent).toContain('hero-claim');
    });

    it('should have statistics section', () => {
      expect(htmlContent).toContain('hero-stats');
      expect(htmlContent).toContain('stat-total');
      expect(htmlContent).toContain('stat-curato');
      expect(htmlContent).toContain('stat-degraded');
    });

    it('should have scroll hint', () => {
      expect(htmlContent).toContain('hero-scroll-hint');
      expect(htmlContent).toContain('Scorri per esplorare');
    });

    it('should have map section', () => {
      expect(htmlContent).toContain('map-section');
      expect(htmlContent).toContain('id="map"');
    });

    it('should have map controls and filters', () => {
      expect(htmlContent).toContain('map-controls');
      expect(htmlContent).toContain('filter-checkbox');
      expect(htmlContent).toContain('value="curato"');
      expect(htmlContent).toContain('value="in degrado"');
    });

    it('should have footer', () => {
      expect(htmlContent).toContain('<footer');
      expect(htmlContent).toContain('CC BY-SA 4.0');
      expect(htmlContent).toContain('Foto');
    });

    it('should have footer purpose statement', () => {
      expect(htmlContent).toContain('documentaristico');
      expect(htmlContent).toContain('spazi verdi');
    });

    it('should have proper lang attribute on images', () => {
      expect(htmlContent).toContain('alt="');
    });
  });

  describe('CSS Structure', () => {
    let cssContent: string;

    beforeAll(() => {
      const cssPath = path.join(process.cwd(), 'src', 'styles', 'main.css');
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    });

    it('should define color variables', () => {
      expect(cssContent).toContain('--color-green');
      expect(cssContent).toContain('--color-red');
      expect(cssContent).toContain('#1a7f37'); // green
      expect(cssContent).toContain('#c0392b'); // red
    });

    it('should have hero styles', () => {
      expect(cssContent).toContain('.hero');
      expect(cssContent).toContain('.hero-split');
      expect(cssContent).toContain('grid-template-columns: 1fr 1fr');
    });

    it('should have responsive styles', () => {
      expect(cssContent).toContain('@media (max-width: 768px)');
    });

    it('should have map styles', () => {
      expect(cssContent).toContain('#map');
      expect(cssContent).toContain('.map-controls');
    });

    it('should have filter styles', () => {
      expect(cssContent).toContain('.filter-label');
      expect(cssContent).toContain('.filter-checkbox');
    });

    it('should have footer styles', () => {
      expect(cssContent).toContain('.footer');
      expect(cssContent).toContain('.footer-attribution');
    });

    it('should have accessibility styles', () => {
      expect(cssContent).toContain('prefers-reduced-motion');
    });

    it('should have animations', () => {
      expect(cssContent).toContain('@keyframes bounce');
    });

    it('should support print styles', () => {
      expect(cssContent).toContain('@media print');
    });
  });

  describe('Data Structure', () => {
    it('should have photos.json after build', () => {
      const dataPath = path.join(process.cwd(), 'src', 'data', 'photos.json');
      expect(fs.existsSync(dataPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      expect(data).toHaveProperty('photos');
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('latestPhotoDate');
      expect(data).not.toHaveProperty('lastUpdated');
    });
  });
});
