# Build Script Guide

The build script validates all photos and generates the data file used by the frontend.

## What It Does

1. **Scans** `src/data/photos/` for photo metadata JSON files
2. **Validates** each photo against the data model schema
3. **Verifies** referenced image files exist in `src/photos/`
4. **Calculates** site statistics (total photos, unique spaces, etc.)
5. **Outputs** `src/data/photos.json` for the frontend
6. **Fails** with clear errors if any validation fails

## Usage

```bash
npm run build
# or
npx tsx src/scripts/build.ts
```

## Example Output

```bash
$ npm run build

🏗️  Building I Giardini di Milano

📂 Scanning for photos...
✅ Found 3 photo(s)

✓ Validating photos...

  ✅ 2024-01-15-parco-sempione-01.json
  ✅ 2024-01-16-parco-sempione-02.json
  ✅ 2024-01-17-parco-vecchio-01.json

📊 Calculating statistics...
  Total photos:    3
  Curated spaces:  1
  Degraded spaces: 1

💾 Writing output...
✅ Written to: src/data/photos.json
   Size: 2.45KB

✨ Build complete!

📄 Summary:
   Photos:          3
   Curated spaces:  1
   Degraded spaces: 1
   Built:           2024-01-15 14:30:45
```

## Validation Rules

The build will **fail** if:

### 1. Photo ID Invalid
- Format must be: `YYYY-MM-DD-slug`
- Example: `2024-01-15-parco-sempione-01`
- ❌ Invalid: `invalid-id`, `2024/01/15`, `parco-sempione`

### 2. Category Unknown
- Must be: `curato` or `in degrado`
- ❌ Invalid: `valid`, `maintained`, `degraded`

### 3. Coordinates Outside Milan
- **Latitude**: must be between 45.35 and 45.55
- **Longitude**: must be between 8.95 and 9.30
- ❌ Invalid: `45.0, 9.0` (too far south)
- ❌ Invalid: `45.5, 9.5` (too far east)

### 4. Date Invalid
- Format must be: `YYYY-MM-DD`
- Must be a valid calendar date
- ❌ Invalid: `2024/01/15`, `15-01-2024`, `2024-13-01`

### 5. Description Too Short
- Minimum 10 characters
- ❌ Invalid: `short` (5 chars)

### 6. Description Too Long
- Maximum 500 characters
- ❌ Invalid: >500 chars

### 7. Space Name Missing
- Required, non-empty string
- Maximum 100 characters
- ❌ Invalid: empty string, >100 chars

### 8. Image File Doesn't Exist
- Must exist at `src/photos/{imageFile}`
- ❌ Invalid: references missing `2024-01-15-parco.jpg`

### 9. JSON Parsing Error
- Metadata file must be valid JSON
- ❌ Invalid: malformed JSON, missing comma

## Output File Format

The build generates `src/data/photos.json`:

```json
{
  "photos": [
    {
      "id": "2024-01-15-parco-sempione-01",
      "category": "curato",
      "coordinates": {
        "latitude": 45.4642,
        "longitude": 9.19
      },
      "date": "2024-01-15",
      "description": "Parco ben curato, aree verdi lussureggianti",
      "space": "Parco Sempione",
      "imageFile": "2024-01-15-parco-sempione-01.jpg"
    },
    ...
  ],
  "stats": {
    "totalPhotos": 3,
    "curatedSpaces": 2,
    "degradedSpaces": 1
  },
  "lastUpdated": "2024-01-15T14:30:45.123Z"
}
```

## Workflow

### 1. Add Photos

Use the ingest script to add photos:

```bash
npx tsx src/scripts/ingest.ts ~/path/to/photo.jpg
```

This creates:
- `src/photos/{id}.jpg` (optimized image)
- `src/data/photos/{id}.json` (metadata)

### 2. Run Build

```bash
npm run build
```

The build will:
- Validate all photos
- Output aggregated data
- Report any errors

### 3. Fix Errors

If validation fails, the build shows which photo(s) have problems:

```
❌ Validation failed with errors:

  2024-01-15-invalid-photo.json:
    id: ID must be in YYYY-MM-DD-slug format

  2024-01-16-outside-milan.json:
    coordinates: Latitude must be >= 45.35 (Milan bounds)

2 photo(s) failed validation.
```

Fix the metadata JSON files and run build again.

### 4. Commit & Deploy

Once build succeeds:

```bash
git add src/photos/ src/data/
git commit -m "Add new photos"
git push origin main
```

The site will automatically deploy with the new photos.

## Statistics

The build calculates:

- **totalPhotos**: Sum of all photos
- **curatedSpaces**: Count of unique spaces with at least one `curato` photo
- **degradedSpaces**: Count of unique spaces with at least one `in degrado` photo

Example:

```
Photo 1: Parco A, curato
Photo 2: Parco A, curato   (same space, still = 1)
Photo 3: Parco B, in degrado

Result:
- totalPhotos: 3
- curatedSpaces: 1 (Parco A)
- degradedSpaces: 1 (Parco B)
```

## Troubleshooting

### "No photos found"

The metadata directory is empty. Add photos using the ingest script:

```bash
npx tsx src/scripts/ingest.ts ~/photo.jpg
```

### "Image file not found"

The metadata references an image that doesn't exist. Either:

1. Verify the `imageFile` in metadata JSON matches actual filename
2. Ensure `src/photos/{imageFile}` exists
3. Re-run the ingest script for that photo

### "Failed to parse ... invalid JSON"

The metadata JSON file is malformed. Edit and fix:

```bash
# Use a JSON validator
cat src/data/photos/2024-01-15-photo.json | jq .
```

### Build hangs or is very slow

With many photos, the build may take time. This is normal. Monitor progress:

```bash
# Watch the process
npm run build -- --verbose
```

## Configuration

Edit `DEFAULT_CONFIG` in `src/scripts/build.ts` to customize:

```typescript
const DEFAULT_CONFIG: BuildConfig = {
  metadataDir: path.join(process.cwd(), 'src', 'data', 'photos'),
  photoDir: path.join(process.cwd(), 'src', 'photos'),
  outputFile: path.join(process.cwd(), 'src', 'data', 'photos.json'),
};
```

## Performance

- **10 photos**: ~50ms
- **50 photos**: ~100ms
- **100+ photos**: <500ms

Validation is fast because it only reads metadata (JSON, not images).

## Next Steps

After a successful build:

1. Check `src/data/photos.json` was created
2. Verify stats are correct (`jq .stats src/data/photos.json`)
3. Run the landing page build to generate the static site
4. Deploy!

## Related

- **Ingest Script**: `INGEST_GUIDE.md`
- **Data Model**: `src/types/types.ts`
- **Validation**: `src/types/schemas.ts` and `src/types/validation.ts`
