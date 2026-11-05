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

### Building Site Data

```bash
npm run build
```

This:
- Validates all photos in `src/data/photos/`
- Verifies image files exist
- Calculates statistics
- Outputs `src/data/photos.json` for the frontend

### Running Tests

```bash
npm run test          # All tests
npm run test -- --ui  # Interactive UI
npm run typecheck     # Type check only
```

Test files:
- `src/types/types.test.ts` - Data model validation (28 tests)
- `src/scripts/ingest.test.ts` - Ingest script (9 tests)
- `src/scripts/build.test.ts` - Build script (22 tests)

**Total: 59 tests**

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
npm run build          # Build site data from photos

# Frontend (not yet implemented)
npm run dev            # Development server (Vite)
npm run preview        # Preview production build
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
