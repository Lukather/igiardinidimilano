/**
 * I Giardini di Milano - Admin Backend Server
 * 
 * Local Node server that handles photo uploads from the admin panel.
 * Reuses the ingest logic (GPS extraction, image optimization, metadata stripping).
 * 
 * Usage:
 *   npm run admin
 * 
 * Then visit: http://localhost:3000/admin
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import busboy from 'busboy';
import sharp from 'sharp';
import { allocatePhotoId } from '../scripts/photo-id.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');

// Configuration
const CONFIG = {
  photoDir: path.join(ROOT, 'src', 'photos'),
  metadataDir: path.join(ROOT, 'src', 'data', 'photos'),
  tempDir: path.join(ROOT, '.admin-temp'),
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 80,
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.photoDir)) {
  fs.mkdirSync(CONFIG.photoDir, { recursive: true });
}
if (!fs.existsSync(CONFIG.metadataDir)) {
  fs.mkdirSync(CONFIG.metadataDir, { recursive: true });
}
if (!fs.existsSync(CONFIG.tempDir)) {
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
}

// ============================================================================
// UPLOAD HANDLER
// ============================================================================

async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const uploadData = await parseUpload(req);

    // Validate required fields
    if (!uploadData.photo) {
      throw new Error('Photo file is required');
    }
    if (!uploadData.latitude || !uploadData.longitude) {
      throw new Error('Coordinates are required');
    }
    if (!uploadData.date) {
      throw new Error('Date is required');
    }
    if (!uploadData.category) {
      throw new Error('Category is required');
    }
    if (!uploadData.space) {
      throw new Error('Space name is required');
    }
    if (!uploadData.description) {
      throw new Error('Description is required');
    }

    // Validate values
    const lat = parseFloat(uploadData.latitude);
    const lon = parseFloat(uploadData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Invalid coordinates');
    }

    if (lat < 45.35 || lat > 45.55 || lon < 8.95 || lon > 9.3) {
      throw new Error('Coordinates are outside Milan bounds');
    }

    if (!['curato', 'in degrado'].includes(uploadData.category)) {
      throw new Error('Invalid category');
    }

    if (uploadData.description.length < 10 || uploadData.description.length > 500) {
      throw new Error('Description must be 10-500 characters');
    }

    if (!uploadData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Invalid date format');
    }

    // Allocate the first free photo ID. Publishing never overwrites an
    // existing photo, even when date and space are identical: the shared
    // allocator is the same one the CLI ingest uses.
    const allocation = allocatePhotoId({
      date: uploadData.date,
      space: uploadData.space,
      metadataDir: CONFIG.metadataDir,
      photoDir: CONFIG.photoDir,
    });
    const photoId = allocation.id;
    const imageFileName = allocation.imageFile;
    const imagePath = allocation.imagePath;
    const metadataPath = allocation.metadataPath;

    // Process image: optimize and strip metadata
    const buffer = await sharp(uploadData.photo)
      .rotate() // Auto-rotate based on EXIF
      .resize(CONFIG.maxWidth, CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: CONFIG.quality, progressive: true })
      .toBuffer();

    // Write optimized image
    fs.writeFileSync(imagePath, buffer);

    // Write metadata
    const metadata = {
      id: photoId,
      category: uploadData.category,
      coordinates: { latitude: lat, longitude: lon },
      date: uploadData.date,
      description: uploadData.description,
      space: uploadData.space,
      imageFile: imageFileName,
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Success response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, photoId, index: allocation.index }));

    console.log(
      `✓ Photo uploaded: ${photoId} (${(buffer.length / 1024).toFixed(1)}KB)` +
        (allocation.index > 1 ? ` — index ${allocation.index}: slot 01 already taken` : ''),
    );
  } catch (error) {
    console.error('Upload error:', error.message);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function parseUpload(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const fields = {};
    let photoBuffer = null;

    bb.on('file', (fieldname, file, info) => {
      if (fieldname === 'photo') {
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
          photoBuffer = Buffer.concat(chunks);
        });
      }
    });

    bb.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    bb.on('close', () => {
      resolve({ photo: photoBuffer, ...fields });
    });

    bb.on('error', reject);
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
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

// ============================================================================
// SERVER
// ============================================================================

const server = http.createServer((req, res) => {
  // Use WHATWG URL API instead of deprecated url.parse()
  const baseUrl = `http://${req.headers.host || 'localhost:3000'}`;
  const parsedUrl = new URL(req.url || '/', baseUrl);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Routes (fix paths: /admin.css not /admin/admin.css)
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

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🌱 Admin panel running on http://localhost:${PORT}/admin`);
  console.log('Press Ctrl+C to stop\n');
});
