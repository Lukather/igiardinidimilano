# Photo Ingest Guide

The ingest script automates the workflow for adding photos to I Giardini di Milano.

## What It Does

1. **Reads original photo** from your computer (outside the repo)
2. **Extracts GPS coordinates** from EXIF data
3. **Proposes coordinates** for your confirmation (you can accept, reject, or correct)
4. **Extracts date** from EXIF (or prompts for manual entry)
5. **Collects photo metadata** (category, space name, description)
6. **Optimizes image** (~1600px max, ~80% quality, ~300KB target)
7. **Strips all metadata** (EXIF, IPTC, XMP) for privacy
8. **Saves optimized image** to `src/photos/`
9. **Saves metadata** to `src/data/photos/` as JSON

## Usage

```bash
npx tsx src/scripts/ingest.ts /path/to/original/photo.jpg
```

### Example Session

```bash
$ npx tsx src/scripts/ingest.ts ~/pictures/parco-sempione-2024.jpg

🌱 I Giardini di Milano — Photo Ingest

📸 Processing: parco-sempione-2024.jpg

🔍 Extracting GPS from EXIF...
✅ GPS found: 45.464200, 9.190000

📍 Proposed coordinates from EXIF:
   Latitude:  45.464200
   Longitude: 9.190000

Accept these coordinates? (y/n, or enter corrected lat,lon): y

📅 Extracting date from EXIF...
✅ Date found: 2024-01-15 (proposed, press Enter to accept)

📋 Enter photo metadata:

Date (YYYY-MM-DD) [2024-01-15]:
Category (curato/in degrado): curato
Space name (e.g., Parco Sempione): Parco Sempione
Description: Parco ben curato, aree verdi lussureggianti e attrezzature funzionanti

🆔 Photo ID: 2024-01-15-parco-sempione-01

⚙️  Optimizing image and stripping metadata...
✅ Image optimized: 245.67KB (target: ~300KB)

🔐 Verifying metadata is stripped...
✅ No metadata found — photo is clean

✅ Metadata saved: src/data/photos/2024-01-15-parco-sempione-01.json

✨ Ingest complete!

📄 Photo metadata:
   ID:          2024-01-15-parco-sempione-01
   Category:    curato
   Date:        2024-01-15
   Space:       Parco Sempione
   Coordinates: 45.464200, 9.190000
   Description: Parco ben curato, aree verdi lussureggianti e attrezzature funzionanti

📁 Files created:
   Photo:    src/photos/2024-01-15-parco-sempione-01.jpg
   Metadata: src/data/photos/2024-01-15-parco-sempione-01.json
```

## Workflow

### Step 1: Coordinate Confirmation

The script extracts GPS from EXIF and asks you to confirm:

- **`y`** or **Enter**: Accept proposed coordinates
- **`n`**: Reject and enter manually
- **`45.4642,9.1900`**: Enter corrected coordinates directly

### Step 2: Metadata Entry

You'll be asked for:

1. **Date** (YYYY-MM-DD): When the photo was taken. If the photo carries a date in EXIF it is proposed in brackets — press Enter to accept it, or type a date to override it.
2. **Category**: `curato` (well-maintained) or `in degrado` (degraded)
3. **Space name**: E.g., "Parco Sempione", "Giardino Pubblico della Martesana"
4. **Description**: Factual, neutral description of what the photo shows

### Step 3: Automatic Processing

The script then:

- Validates the metadata against the same schema the build uses, **before** writing anything: an invalid value stops the ingest with an error naming the field, and no half-published photo is left on disk
- Generates a unique photo ID: `YYYY-MM-DD-space-name-NN`, using the first free index — publishing never overwrites an existing photo (see "Photo IDs and collisions" in `DEVELOPMENT.md`)
- Resizes image to max 1600×1600 pixels (preserving aspect ratio)
- Compresses with 80% JPEG quality (target ~300KB)
- Strips all EXIF, IPTC, XMP metadata
- Saves optimized image as `src/photos/{id}.jpg`
- Saves metadata as `src/data/photos/{id}.json`

## Output Files

### Optimized Image
- **Path**: `src/photos/2024-01-15-parco-sempione-01.jpg`
- **Size**: ~300KB (configurable)
- **Properties**: No metadata, auto-rotated from EXIF orientation

### Metadata JSON
- **Path**: `src/data/photos/2024-01-15-parco-sempione-01.json`
- **Content**:
  ```json
  {
    "id": "2024-01-15-parco-sempione-01",
    "category": "curato",
    "coordinates": {
      "latitude": 45.4642,
      "longitude": 9.19
    },
    "date": "2024-01-15",
    "description": "Parco ben curato",
    "space": "Parco Sempione",
    "imageFile": "2024-01-15-parco-sempione-01.jpg"
  }
  ```

## Requirements

### Original Photo

- **Format**: JPG, PNG, WebP (any standard format)
- **Should have EXIF GPS data** (if possible)
- **Location**: Outside the repo (private folder on your computer)
- **Never stored in repo**: Only the optimized, metadata-stripped version goes in

### Software

- **Node.js 18+**
- **Dependencies**: sharp, exifreader (already in package.json)

## Troubleshooting

### "No GPS data found in photo EXIF"

If your photo doesn't have GPS:

1. The script will ask you to enter coordinates manually
2. Format: `latitude,longitude` (e.g., `45.4642,9.1900`)
3. Check [Google Maps](https://maps.google.com) to find the exact location

### Coordinates outside Milan bounds

The build will fail if coordinates are outside Milan:

- **Latitude**: 45.35 to 45.55
- **Longitude**: 8.95 to 9.30

Correct the coordinates during the ingest process.

### Large file size after optimization

If the optimized image is much larger than 300KB:

1. The script will still proceed (it's a target, not a hard limit)
2. You can manually adjust the quality in `DEFAULT_CONFIG` in `ingest.ts`
3. Typical photos are 200-300KB

## Legal Notes

All photos must comply with the legal policy from the spec:

- ✅ **No recognizable faces** (one rule for adults and minors)
- ✅ **No readable license plates**
- ✅ **No recognizable artworks** (even incidentally)
- ✅ **Metadata completely stripped** (done automatically)
- ✅ **Manual coordinate confirmation** (ensures precision)

Photos that violate these rules will fail build validation.

## Next Steps

After ingest:

1. **Do not commit individual photo files**
2. Run the **build script** to:
   - Validate all photos
   - Calculate site statistics
   - Generate `src/data/photos.json` for the frontend
3. Commit the repo (with photos and metadata)
4. Deploy the site

