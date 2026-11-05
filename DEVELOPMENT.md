# Development Guide

Quick start for developers working on I Giardini di Milano.

## Setup

```bash
# Install dependencies
npm install

# Type-check
npm run typecheck

# Run tests
npm run test
```

## Workflow

### Adding Photos

1. **Prepare original photo** (JPG with EXIF GPS preferred)
2. **Run ingest script**:
   ```bash
   npm run ingest /path/to/original/photo.jpg
   ```
3. **Respond to prompts**:
   - Confirm/correct GPS coordinates
   - Confirm date (extracted from EXIF or manual)
   - Select category: `curato` or `in degrado`
   - Enter space name (e.g., "Parco Sempione")
   - Enter description (factual, neutral tone)

4. **Output** (created automatically):
   - `src/photos/{id}.jpg` - Optimized image (no metadata, ~300KB)
   - `src/data/photos/{id}.json` - Photo metadata

### Publishing the Site

```bash
npm run build
```

This is the single publication command. It runs two steps in order:

1. **`npm run build:data`** — validates every photo in `src/data/photos/`, verifies the referenced images exist, calculates the statistics and writes `src/data/photos.json`.
2. **`npm run build:site`** — bundles the frontend with Vite and copies `photos.json` plus every image it references into `dist/`.

`dist/` is then self-contained and deployable as-is on any static host: `index.html`, `assets/`, `data/photos.json`, `photos/`.

`src/data/photos.json` is versioned and **reproducible**: same input photos, byte-identical file. Photos are sorted newest first (ties by ID ascending) and the only date in the file, `latestPhotoDate`, comes from the data — there is no build timestamp, so rebuilding without content changes leaves the working tree clean.

**Publishing gate:** `build:site` refuses to publish any image that still carries
EXIF, GPS, XMP or ICC metadata, or that is not a readable image. The ingest strips
it with sharp, but nothing else stops an unstripped JPEG from being dropped into
`src/photos/` by hand — and that would publish the photographer's GPS coordinates.

**Contract between the two steps:** the site build *depends on* the data build. `build:site` fails with an actionable message if `src/data/photos.json` is missing or if the data references an image that does not exist on disk. Only images referenced by the data are published — unreferenced files in `src/photos/` never reach the output.

Running the steps separately is fine when you only need one of them:

```bash
npm run build:data   # regenerate src/data/photos.json only
npm run build:site   # rebuild dist/ from the existing data
npm run preview      # serve dist/ locally
```

### Photo IDs and collisions

A photo ID is `YYYY-MM-DD-space-slug-NN`, where `NN` disambiguates photos that
share the same date and space.

**Publishing never overwrites an existing photo.** Both the CLI ingest and the
admin panel allocate the first free index through the same shared allocator
(`src/scripts/photo-id.ts`):

```
2024-01-15-parco-sempione-01   ← already published
2024-01-15-parco-sempione-02   ← what the next publish gets
```

A slot counts as taken when either the metadata file or the image file exists,
so a half-written photo also protects its slot. If the base slot is taken, the
assigned index is reported in the output (CLI) and in the admin panel message.
Gaps are filled: if `-01` and `-03` exist, the next photo becomes `-02`.

To *replace* a photo, delete its metadata file and image first — there is no
overwrite path by design. When all indexes `01`–`99` are taken the publish stops
with an error instead of creating a duplicate.

### Running Tests

```bash
npm run test          # All tests
npm run test -- --ui  # Interactive UI
npm run typecheck     # Type check only
```

Test files:
- `src/site-build.test.ts` - **End-to-end**: fixtures in, built site out (data, published images, landing page, validation failures)
- `src/types/types.test.ts` - Data model and schema validation
- `src/scripts/build-output.test.ts` - Reproducibility, ordering and validation failures of the data build
- `src/scripts/emit-site-assets.test.ts` - Publication of data and images, including the metadata gate
- `src/scripts/photo-id.test.ts` - Photo ID allocation
- `src/scripts/ingest-input.test.ts` - Answers to the ingest prompts and metadata validation
- `src/scripts/ingest-exif.test.ts` - Date extraction from EXIF and metadata stripping
- `src/popup.test.ts` - Popup content, including metadata containing markup
- `src/map-tiles.test.ts` - Tile provider policy
- `src/admin/admin-assets.test.ts` - Admin panel assets

The suite follows one rule: assert on what the pipeline produces, not on how it is
built. `site-build.test.ts` is the seam — it runs the real data build and a real
Vite build over generated fixtures, then inspects the artefacts. Tests that
asserted on helper functions, on copies of the logic, or on CSS internals were
removed in favour of it.

## Data Model

### Photo Metadata

Each photo has:

```typescript
{
  id: "2024-01-15-parco-sempione-01",           // Unique ID: YYYY-MM-DD-slug
  category: "curato" | "in degrado",            // Well-maintained or degraded
  coordinates: {                                  // GPS (manually confirmed)
    latitude: 45.4642,                          // 45.35 to 45.55 (Milan)
    longitude: 9.1900                           // 8.95 to 9.30 (Milan)
  },
  date: "2024-01-15",                           // YYYY-MM-DD format
  description: "Parco ben curato...",           // 10-500 characters
  space: "Parco Sempione",                      // Green space name (tag)
  imageFile: "2024-01-15-parco-sempione-01.jpg" // Optimized image filename
}
```

### Files

```
src/
├── types/
│   ├── types.ts              # Core types and constants
│   ├── schemas.ts            # Zod validation schemas
│   ├── validation.ts         # Validation utilities
│   └── types.test.ts         # Type tests
│
├── scripts/
│   ├── ingest.ts             # Photo ingest workflow
│   ├── ingest.test.ts        # Ingest tests
│   ├── build.ts              # Site data builder
│   ├── build.test.ts         # Build tests
│   ├── photo-id.ts           # Photo ID allocation (no overwrites)
│   ├── emit-site-assets.ts   # Copies data + photos into dist/
│   └── create-test-photo.ts  # Test helper
│
├── photos/                    # Optimized images (gitignored individually)
│   └── 2024-01-15-*.jpg
│
└── data/
    ├── photos/               # Photo metadata (JSON)
    │   └── 2024-01-15-*.json
    └── photos.json           # Built aggregated data
```

## Commands

```bash
# Development
npm run typecheck      # Check TypeScript types
npm run test           # Run all tests
npm run test -- --ui   # Interactive test UI

# Scripts
npm run ingest         # Start ingest workflow (needs file path argument)
npm run build          # Publish: build data, then build the site into dist/
npm run build:data     # Regenerate src/data/photos.json only
npm run build:site     # Rebuild dist/ from the existing data

# Frontend
npm run dev            # Development server (Vite)
npm run preview        # Preview the production build in dist/
```

## Error Handling

### Build Validation Errors

If `npm run build` fails, it shows which photos have issues and why:

```
❌ Validation failed with errors:

  2024-01-15-invalid.json:
    0.id: ID must be in YYYY-MM-DD-slug format
    0.category: Invalid enum value. Expected 'curato' | 'in degrado'
    0.coordinates.latitude: Latitude must be >= 45.35 (Milan bounds)

1 photo(s) failed validation.
```

**Fix**: Edit the metadata JSON file to correct the error, then re-run build.

### Ingest Errors

If GPS extraction or image optimization fails, the ingest script reports it and asks for manual input.

## Validation Rules

Photo metadata must pass:

- ✅ **ID**: `YYYY-MM-DD-slug` format
- ✅ **Category**: `curato` or `in degrado`
- ✅ **Coordinates**: Within Milan bounds (45.35-45.55 lat, 8.95-9.30 lon)
- ✅ **Date**: Valid YYYY-MM-DD
- ✅ **Description**: 10-500 characters
- ✅ **Space**: 1-100 characters, required
- ✅ **Image File**: Must exist at `src/photos/{filename}`

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes, ensure tests pass: `npm run test`
3. Type-check: `npm run typecheck`
4. Commit with clear messages
5. Push and create a PR

## Guides

- **Ingest Script**: See `INGEST_GUIDE.md`
- **Build Pipeline**: See `BUILD_GUIDE.md`
- **Spec**: See GitHub issue #7 for complete v1 specification

## Architecture

### Static Site Generator

- **Input**: Photo metadata (JSON) + optimized images
- **Processing**: Validation, stats calculation
- **Output**: `src/data/photos.json` for frontend

No database, no server required. Everything is built at deploy time.

### Image Processing

- **Original**: Outside repo (your computer)
- **Ingest**: Extract GPS, confirm coords, optimize image, strip metadata
- **Output**: Metadata JSON + optimized image → repo
- **Build**: Validate + aggregate → site data

### Legal Compliance

- No recognizable faces (one rule for adults/minors)
- No readable license plates
- No recognizable artworks (even incidentally)
- All EXIF/IPTC/XMP metadata stripped
- Manual GPS coordinate confirmation

## Future Work

- Landing page (Variant B from prototype)
- Leaflet map with CARTO tiles
- Category filters
- Mobile responsiveness
- i18n for other languages
- Anonymous reporting system (v2+)

## Support

See the main issue for complete specification: GitHub issue #7
