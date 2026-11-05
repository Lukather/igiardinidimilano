import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ADMIN_DIR = path.join(process.cwd(), 'src', 'admin');
const ADMIN_HTML = fs.readFileSync(path.join(ADMIN_DIR, 'admin.html'), 'utf-8');
const ADMIN_SERVER = fs.readFileSync(path.join(ADMIN_DIR, 'admin-server.mjs'), 'utf-8');
const LEAFLET_DIST = path.join(process.cwd(), 'node_modules', 'leaflet', 'dist');

describe('Admin panel assets', () => {
  describe('Leaflet', () => {
    it('is not loaded from a CDN', () => {
      expect(ADMIN_HTML).not.toContain('unpkg.com');
      expect(ADMIN_HTML).not.toMatch(/https?:\/\/[^"']*leaflet/i);
    });

    it('is served by the admin server from the installed package', () => {
      expect(ADMIN_HTML).toContain('/vendor/leaflet/leaflet.js');
      expect(ADMIN_HTML).toContain('/vendor/leaflet/leaflet.css');
      expect(ADMIN_SERVER).toContain("path.join(ROOT, 'node_modules', 'leaflet', 'dist'");
    });

    it('serves files that actually exist in the package', () => {
      // The panel is local-only: if the package is installed, the files are
      // there, and the panel works offline.
      expect(fs.existsSync(path.join(LEAFLET_DIST, 'leaflet.js'))).toBe(true);
      expect(fs.existsSync(path.join(LEAFLET_DIST, 'leaflet.css'))).toBe(true);
    });

    it('exposes only the two known files, so the path cannot escape the package', () => {
      expect(ADMIN_SERVER).toContain("const allowed = ['leaflet.js', 'leaflet.css']");
    });
  });

  describe('No external hosts at all', () => {
    it('loads no script or stylesheet from an external host', () => {
      const externalScripts = ADMIN_HTML.match(/<script[^>]+src="https?:\/\/[^"]+"/g) ?? [];
      const externalStyles = ADMIN_HTML.match(/<link[^>]+href="https?:\/\/[^"]+"/g) ?? [];

      expect([...externalScripts, ...externalStyles]).toEqual([]);
    });
  });
});
