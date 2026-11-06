import { defineConfig } from 'vite';

/**
 * Build for the public upload form.
 *
 * Output goes to `form/dist`, which is what `wrangler pages deploy` publishes.
 * `functions/` stays next to this file: Pages looks for it there, not in the
 * build output.
 */
export default defineConfig({
  root: __dirname,
  // Relative URLs, like the site: the form must work under any path.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3100,
  },
});
