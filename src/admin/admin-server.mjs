/**
 * I Giardini di Milano - Admin server
 *
 * Local authoring tool: uploads a photo, writes the same artefacts the CLI
 * ingest writes, and regenerates the aggregated data. It is not part of the
 * published site and must never be deployed.
 *
 * Everything it does with a photo comes from the shared modules the CLI uses:
 * ID allocation, metadata validation, optimization and metadata stripping.
 * There is no second implementation to keep in sync.
 *
 * Usage:
 *   npm run admin
 *   open http://127.0.0.1:3001/admin
 *
 * Environment:
 *   ADMIN_HOST          bind address (default 127.0.0.1)
 *   ADMIN_PORT          port (default 3001)
 *   ADMIN_MAX_UPLOAD_MB maximum upload size in MB (default 25)
 *   ADMIN_PHOTO_DIR     where images are written
 *   ADMIN_METADATA_DIR  where photo metadata is written
 *   ADMIN_DATA_FILE     aggregated data file to regenerate
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { URL, fileURLToPath } from 'url';
import busboy from 'busboy';
import { allocatePhotoId } from '../scripts/photo-id.ts';
import { optimizeImage } from '../scripts/optimize-image.ts';
import { IMAGE_BUDGET } from '../scripts/image-budget.ts';
import { buildPhotoMetadata } from '../scripts/ingest-input.ts';
import { build } from '../scripts/build.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

const CONFIG = {
  photoDir: process.env.ADMIN_PHOTO_DIR ?? path.join(ROOT, 'src', 'photos'),
  metadataDir: process.env.ADMIN_METADATA_DIR ?? path.join(ROOT, 'src', 'data', 'photos'),
  dataFile: process.env.ADMIN_DATA_FILE ?? path.join(ROOT, 'src', 'data', 'photos.json'),
  host: process.env.ADMIN_HOST ?? '127.0.0.1',
  port: Number(process.env.ADMIN_PORT ?? 3001),
  maxUploadBytes: Number(process.env.ADMIN_MAX_UPLOAD_MB ?? 25) * 1024 * 1024,
};

// Multipart overhead: boundaries, field names, the other form fields.
const MULTIPART_SLACK_BYTES = 1024 * 1024;

for (const dir of [CONFIG.photoDir, CONFIG.metadataDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ============================================================================
// UPLOAD HANDLER
// ============================================================================

/** Errors that carry an HTTP status instead of being a plain 400. */
class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    respondJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const upload = await parseUpload(req);

    if (!upload.photo) {
      throw new UploadError('Photo file is required');
    }

    const latitude = Number(upload.latitude);
    const longitude = Number(upload.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new UploadError('Coordinates are required and must be numbers');
    }

    // Allocate the first free photo ID: publishing never overwrites an
    // existing photo, even when date and space are identical.
    const allocation = allocatePhotoId({
      date: upload.date ?? '',
      space: upload.space ?? '',
      metadataDir: CONFIG.metadataDir,
      photoDir: CONFIG.photoDir,
    });

    // Same validation as the CLI: the shared schema, before anything is
    // written. An invalid value stops here and names the field.
    const metadata = buildPhotoMetadata({
      id: allocation.id,
      category: upload.category ?? '',
      coordinates: { latitude, longitude },
      date: upload.date ?? '',
      description: upload.description ?? '',
      space: upload.space ?? '',
      imageFile: allocation.imageFile,
      // Optional: the shared normaliser turns a blank answer into "no credit".
      author: upload.author ?? '',
    });

    const optimized = await optimizeImage(upload.photo, allocation.imagePath);

    fs.writeFileSync(allocation.metadataPath, JSON.stringify(metadata, null, 2));

    // Keep the repo coherent: the aggregated data is regenerated here, so the
    // photo is immediately part of the site data.
    const stats = await rebuildData();

    respondJson(res, 200, {
      success: true,
      photoId: metadata.id,
      index: allocation.index,
      sizeKB: Math.round(optimized.sizeKB),
      withinBudget: optimized.withinBudget,
      targetSizeKB: IMAGE_BUDGET.targetSizeKB,
      stats,
    });

    console.log(
      `✓ Photo uploaded: ${metadata.id} (${optimized.sizeKB.toFixed(0)}KB, ` +
        `quality ${optimized.quality})` +
        (allocation.index > 1 ? ` — index ${allocation.index}: slot 01 already taken` : '') +
        (optimized.withinBudget ? '' : ' — over budget'),
    );
    console.log(`  ${stats.totalPhotos} photo(s) in the site data`);
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 400;
    console.error(`Upload error (${status}):`, error.message);
    respondJson(res, status, { error: error.message });
  }
}

/**
 * Regenerate the aggregated data with the shared build, quietly.
 * Returns the new stats so the panel can show them.
 */
async function rebuildData() {
  const { log, warn, error } = console;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    await build({
      metadataDir: CONFIG.metadataDir,
      photoDir: CONFIG.photoDir,
      outputFile: CONFIG.dataFile,
    });
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }

  const data = JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf-8'));
  return data.stats;
}

// ============================================================================
// HELPERS
// ============================================================================

function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Parse the multipart upload, refusing anything above the size limit before
 * buffering it.
 */
function parseUpload(req) {
  return new Promise((resolve, reject) => {
    // Cheap pre-check: refuse an oversized body without reading it.
    const declaredLength = Number(req.headers['content-length'] ?? 0);
    if (declaredLength > CONFIG.maxUploadBytes + MULTIPART_SLACK_BYTES) {
      reject(
        new UploadError(
          `Upload too large: ${(declaredLength / 1024 / 1024).toFixed(1)}MB, ` +
            `limit ${(CONFIG.maxUploadBytes / 1024 / 1024).toFixed(0)}MB`,
          413,
        ),
      );
      req.resume();
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: CONFIG.maxUploadBytes,
        files: 1,
        fields: 20,
        parts: 25,
      },
    });

    const fields = {};
    let photo = null;
    let tooLarge = false;

    bb.on('file', (fieldname, file, info) => {
      if (fieldname !== 'photo') {
        file.resume();
        return;
      }

      const chunks = [];
      let size = 0;

      file.on('data', (chunk) => {
        size += chunk.length;
        // Keep buffering bounded even if the limit is somehow missed.
        if (size <= CONFIG.maxUploadBytes) {
          chunks.push(chunk);
        }
      });

      file.on('limit', () => {
        tooLarge = true;
      });

      file.on('end', () => {
        if (!tooLarge) {
          photo = Buffer.concat(chunks);
        }
      });
    });

    bb.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    bb.on('error', (error) => {
      reject(new UploadError(`Could not read the upload: ${error.message}`));
    });

    bb.on('close', () => {
      if (tooLarge) {
        reject(
          new UploadError(
            `Upload too large: limit ${(CONFIG.maxUploadBytes / 1024 / 1024).toFixed(0)}MB`,
            413,
          ),
        );
        return;
      }

      resolve({ photo, ...fields });
    });

    req.pipe(bb);
  });
}

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

function serveStatic(req, res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

// ============================================================================
// SERVER
// ============================================================================

const server = http.createServer((req, res) => {
  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const pathname = new URL(req.url || '/', baseUrl).pathname;

  // The panel is local: no cross-origin access is needed.
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/admin' && req.method === 'GET') {
    serveStatic(req, res, path.join(__dirname, 'admin.html'));
  } else if (pathname === '/admin.css' && req.method === 'GET') {
    serveStatic(req, res, path.join(__dirname, 'admin.css'));
  } else if (pathname === '/admin.js' && req.method === 'GET') {
    serveStatic(req, res, path.join(__dirname, 'admin.js'));
  } else if (pathname.startsWith('/vendor/leaflet/') && req.method === 'GET') {
    // Leaflet is served from the installed package instead of a CDN: the
    // panel is a local tool and must work offline. Only known files are
    // exposed, so the path cannot escape the package directory.
    const leafletFile = pathname.slice('/vendor/leaflet/'.length);
    const allowed = ['leaflet.js', 'leaflet.css'];

    if (!allowed.includes(leafletFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    serveStatic(req, res, path.join(ROOT, 'node_modules', 'leaflet', 'dist', leafletFile));
  } else if (pathname === '/api/upload') {
    handleUpload(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const { port } = server.address();

  if (!LOOPBACK.has(CONFIG.host)) {
    console.warn(
      `⚠️  Listening on ${CONFIG.host}, not on loopback: the panel has no ` +
        'authentication and can write into the repo. Use it only on a network you trust.',
    );
  }

  console.log(`🌱 Admin panel running on http://${CONFIG.host}:${port}/admin`);
  console.log(`   Photos:   ${path.relative(ROOT, CONFIG.photoDir) || CONFIG.photoDir}`);
  console.log(`   Metadata: ${path.relative(ROOT, CONFIG.metadataDir) || CONFIG.metadataDir}`);
  console.log('Press Ctrl+C to stop\n');
});
