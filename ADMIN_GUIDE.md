# Admin Panel Guide — Photo Upload

Upload photos directly from a web interface instead of using the CLI.

## Quick Start

```bash
# 1. Start the admin panel server
npm run admin

# 2. Open in your browser
#    http://localhost:3000/admin

# 3. Upload photos using the web form

# 4. After uploading, build the site data
npm run build

# 5. Commit and push to publish
git add src/photos/ src/data/photos.json
git commit -m "Add 3 new photos"
git push
```

## Features

### 1. Drag-and-Drop Upload
- **Click or drag** a photo onto the upload area
- Supports JPG and PNG
- Shows image preview instantly

### 2. Interactive Map
- **Click on the map** to set/adjust the GPS pin
- Or enter latitude/longitude directly in the input fields
- Map centered on Milan with zoom controls
- Scroll-wheel zoom only activates when hovering

### 3. Metadata Form
- **Date**: Auto-filled with today's date (editable)
- **Category**: Choose between "Curato" (well-maintained) or "In degrado" (degraded)
- **Space Name**: E.g., "Parco Sempione", "Giardino Pubblico"
- **Description**: 10-500 characters, required
- Real-time character counter with validation

### 4. Validation
- All fields are required
- Coordinates must be within Milan bounds (45.35-45.55, 8.95-9.30)
- Description must be 10-500 characters
- Photo ID auto-generated: `YYYY-MM-DD-space-slug-01`

### 5. Upload Processing
When you click "Carica Foto":
1. Image is resized (max 1600×1600) and compressed (~300KB)
2. All EXIF/IPTC/XMP metadata is stripped automatically
3. Optimized image saved to `src/photos/{photoId}.jpg`
4. Metadata JSON saved to `src/data/photos/{photoId}.json`

### 6. Success Message
After successful upload:
- Photo ID is displayed
- You're prompted to run `npm run build` to regenerate the site data
- Form resets automatically

## Workflow

### Development Mode (Local)

```
Admin Panel (Web UI)
      ↓ (drag-drop photo, fill form, click upload)
      ↓
 Admin Server (Port 3000)
      ↓ (process: optimize, strip metadata, save)
      ↓
src/photos/{id}.jpg + src/data/photos/{id}.json
      ↓ (you run: npm run build)
      ↓
src/data/photos.json (aggregated data for frontend)
      ↓ (you git commit/push)
      ↓
Production Site (GitHub Pages / Netlify / Vercel)
```

### Key Difference from CLI

| Aspect | CLI (`npm run ingest`) | Admin Panel (`npm run admin`) |
|--------|---|---|
| **Interface** | Terminal, interactive prompts | Web form, drag-drop |
| **GPS confirmation** | Type coordinates in terminal | Click map to set pin |
| **Metadata** | Terminal prompts for each field | Web form with live validation |
| **Image preview** | None | Shows in real-time |
| **Use case** | Automated, scripted | Manual, interactive |

Both workflows produce identical results — files in the same locations with the same structure.

## Troubleshooting

### "Address already in use" error
The admin server is already running. Either:
- Wait a moment and try again
- Find and kill the process: `lsof -ti:3000 | xargs kill -9`
- Use a different port by editing `admin-server.mjs`

### "Coordinates are outside Milan bounds"
Check that your lat/lon are within:
- Latitude: 45.35 to 45.55
- Longitude: 8.95 to 9.30

### "Upload failed" with no details
- Check browser console (F12 → Console tab)
- Check terminal where admin server is running
- Ensure your image is valid JPG/PNG

### "Cannot find module 'busboy'"
Run `npm install` to install dependencies

## After Upload

1. **Check the files were created**:
   ```bash
   ls src/photos/{photoId}.jpg
   ls src/data/photos/{photoId}.json
   ```

2. **Regenerate site data**:
   ```bash
   npm run build
   ```

3. **Commit to git**:
   ```bash
   git add src/photos/ src/data/photos/
   git commit -m "Add photo: {description}"
   git push origin main
   ```

4. **Site deploys automatically** (if using GitHub Pages / Netlify / Vercel)

## Technical Details

### Server
- **Language**: Node.js (ESM)
- **Dependencies**: busboy, sharp
- **Port**: 3000 (local, dev-only)
- **No database**: All files written directly to `src/photos/` and `src/data/photos/`

### Client
- **Framework**: Vanilla JavaScript (no dependencies)
- **Map**: Leaflet (CDN)
- **Tiles**: OpenStreetMap (free, no API key)

### Processing Pipeline
1. **File received** via HTTP multipart/form-data
2. **Image processed** with Sharp:
   - Auto-rotate based on EXIF orientation
   - Resize to max 1600×1600 (preserve aspect ratio)
   - Compress as JPEG (80% quality)
   - Strip all metadata (automatic)
3. **Metadata JSON** created with validated fields
4. **Files written** to disk atomically

## Security Notes

- ✅ Server only runs locally (dev mode)
- ✅ No authentication required (it's your machine)
- ✅ File uploads are written only to `src/photos/` and `src/data/photos/`
- ✅ All coordinate/metadata validation matches backend schema
- ⚠️ Not suitable for production (no user auth, no rate limiting)

## Future Enhancements

Possible improvements:
- [ ] Batch upload (multiple photos at once)
- [ ] Photo library view (browse uploaded photos)
- [ ] Date & time picker (instead of text input)
- [ ] "Undo" / delete last photo
- [ ] Photo editing (crop, rotate)
- [ ] EXIF GPS auto-extraction (more sophisticated parsing)
- [ ] Hosted admin panel (requires backend server)

## Related

- **Ingest Script**: `INGEST_GUIDE.md` (CLI alternative)
- **Build Pipeline**: `BUILD_GUIDE.md` (data aggregation)
- **Landing Page**: `LANDING_PAGE_GUIDE.md` (what users see)

---

**Questions?** Check the project README or GitHub issues.
