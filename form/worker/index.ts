/**
 * Worker entry for the public upload form.
 *
 * Static assets are served by Cloudflare before this code runs, so only paths
 * with no matching file reach here — in practice, `/api/upload`. Everything
 * else is a genuine 404 rather than a fallback to the form.
 */

import { handleUpload, type Env } from '../src/upload-handler';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/upload') {
      return handleUpload(request, env);
    }

    return new Response('Non trovato', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
