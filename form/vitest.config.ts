import { defineConfig } from 'vitest/config';

/**
 * Tests for the upload form.
 *
 * Kept separate from the site's suite: the site runs on vitest 1.x, and these
 * tests boot a real R2 bucket through Miniflare, which needs its own setup.
 * Run with `npm run test:form`.
 */
export default defineConfig({
  root: __dirname,
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Miniflare starts a workerd process; the first boot is not instant.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
