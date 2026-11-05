import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { emitSiteAssets } from './src/scripts/emit-site-assets';

const DATA_FILE = path.resolve(__dirname, 'src/data/photos.json');
const PHOTO_DIR = path.resolve(__dirname, 'src/photos');

/**
 * Publish the generated data and the optimized photos alongside the bundle.
 *
 * Vite emits only the HTML/CSS/JS bundle, but the site fetches
 * `./data/photos.json` and `./photos/{imageFile}` at runtime. Without this
 * step the deployed site 404s on its own data.
 */
function siteAssetsPlugin(): Plugin {
  let outDir = path.resolve(__dirname, 'dist');

  return {
    name: 'igiardinidimilano:site-assets',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      let result;
      try {
        result = emitSiteAssets({
          dataFile: DATA_FILE,
          photoDir: PHOTO_DIR,
          outDir,
        });
      } catch (error) {
        // Surface a clean build error instead of a stack trace: a broken site
        // must never ship silently.
        this.error(error instanceof Error ? error.message : String(error));
        return;
      }

      console.log(
        `✓ Site assets: ${result.photos} photo(s), ${result.images} image(s) → ${path.relative(process.cwd(), result.dataFile)}`,
      );
    },
  };
}

/**
 * Fail fast in development when the aggregated data is missing, instead of
 * letting the landing page show its error screen with no explanation.
 */
function siteDataCheckPlugin(): Plugin {
  return {
    name: 'igiardinidimilano:site-data-check',
    apply: 'serve',
    configureServer(server) {
      if (!fs.existsSync(DATA_FILE)) {
        server.config.logger.error(
          'Site data not found at src/data/photos.json. Run "npm run build:data" first.',
        );
      }
    },
  };
}

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Leaflet's stylesheet references marker icons we never use (the map draws
    // circle markers). Inlining them as base64 would ship ~7.5 kB to every
    // visitor; as separate files they are only fetched if something uses them.
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [siteDataCheckPlugin(), siteAssetsPlugin()],
  server: {
    port: 3000,
    open: true,
  },
});
