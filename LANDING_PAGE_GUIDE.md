# Landing Page Guide

The landing page is the entry point to I Giardini di Milano. It showcases the contrast between well-maintained and degraded green spaces using a split-screen hero, then allows users to explore all photos on an interactive map.

## Design: Variant B

From the prototype exploration, **Variant B** was chosen:
- Dark theme (high contrast, modern)
- Split-screen hero showing both states simultaneously
- Claim + statistics prominently displayed
- Map below for exploration
- Footer with CC BY-SA 4.0 attribution

## Structure

### Files

```
src/
├── index.html          # Main HTML entry point
├── main.ts             # TypeScript application logic
├── main.test.ts        # Landing page tests (27 tests)
└── styles/
    └── main.css        # Complete stylesheet (~500 lines)
```

### Component Layout

```
┌─────────────────────────────────────────────────────┐
│                    HERO SECTION                      │
│  ┌─────────────────┬─────────────────┐              │
│  │   CURATO        │  IN DEGRADO     │              │
│  │   (photo)       │   (photo)       │              │
│  │   ●CURATO       │  ●IN DEGRADO    │              │
│  │                 │                 │              │
│  │       ┌─────────────────────────────┐            │
│  │       │  I Giardini di Milano       │            │
│  │       │  Claim text                 │            │
│  │       │  [#] foto  [#] curati [#].. │            │
│  │       └─────────────────────────────┘            │
│  │       ↓ Scorri per esplorare                     │
│  └─────────────────┴─────────────────┘              │
├─────────────────────────────────────────────────────┤
│                   MAP SECTION                        │
│  ┌──────────────────────────────────┐              │
│  │ ☐ Curato  ☐ In degrado          │              │
│  └──────────────────────────────────┘              │
│                                                      │
│         [Interactive Leaflet Map]                   │
│         - Circle markers (green/red)                │
│         - Click for photo details                   │
│         - Filter by category                        │
│                                                      │
├─────────────────────────────────────────────────────┤
│                   FOOTER                             │
│  © I Giardini di Milano · Foto CC BY-SA 4.0        │
│  Un sito documentaristico sui spazi verdi...       │
└─────────────────────────────────────────────────────┘
```

## Features

### 1. Hero Section (Split Screen)

**Left half**: Well-maintained photo
- Tag: "CURATO"
- Green color scheme

**Right half**: Degraded photo
- Tag: "IN DEGRADO"
- Red color scheme

**Overlay**: Central content area
- Title: "I Giardini di Milano"
- Claim: Contrasts the two states
- Statistics: Total photos, unique curated/degraded spaces
- Scroll hint with animation

### 2. Map Section

**Leaflet Map**:
- CARTO tiles (OSM-compliant CDN)
- Centered on Milan (45.4642, 9.1900)
- Zoom level 12 by default

**Markers**:
- Circle markers (radius 8px)
- Green (#1a7f37) for curato
- Red (#c0392b) for in degrado
- White ring (3px) for accessibility/contrast

**Popups**:
- Photo thumbnail
- Space name (bold)
- Category badge
- Description text
- Date
- Exact coordinates

### 3. Controls

**Category Filter**:
- Checkbox: "Curato" (green)
- Checkbox: "In degrado" (red)
- Default: both checked
- Real-time marker visibility update

### 4. Footer

- CC BY-SA 4.0 attribution with link
- Purpose statement (Italian)
- Links to Creative Commons deed

## Styling

### Color Scheme

| Role | Color | Hex |
|------|-------|-----|
| Curato | Green | #1a7f37 |
| Degraded | Red | #c0392b |
| Background | Dark | #0e0e0e |
| Text | Light | #f2f2f2 |
| Muted | Gray | #cccccc |

### Responsive Design

- **Desktop**: Split screen hero, full-width map
- **Tablet** (≤1024px): Still split, but responsive spacing
- **Mobile** (<768px): Stacked hero (2 full-height photos), map controls repositioned

### Accessibility

- ✅ **Colorblind safe**: Markers have white ring + distinct shapes
- ✅ **Text contrast**: WCAG AA compliant
- ✅ **Motion**: Reduced motion support (@prefers-reduced-motion)
- ✅ **Keyboard**: All interactive elements are keyboard accessible
- ✅ **Semantic HTML**: Proper heading hierarchy, form labels

## JavaScript Behavior

### Initialization Flow

1. **Load Data**
   - Fetch `src/data/photos.json` (built by build script)
   - Catch errors and show helpful message

2. **Initialize Hero**
   - Find first "curato" photo
   - Find first "in degrado" photo
   - Display in split-screen
   - Update statistics

3. **Initialize Map**
   - Create Leaflet map centered on Milan
   - Add CARTO tiles layer
   - Fit within bounds

4. **Add Markers**
   - For each photo, create circle marker
   - Position at GPS coordinates
   - Add popup with photo info
   - Filter based on category

5. **Initialize Filters**
   - Attach change event to checkboxes
   - Update marker visibility on filter change

### Error Handling

If `photos.json` is not found:
- Show error message overlay
- Suggest running `npm run build`
- Console logs for debugging

## Development

### Run Dev Server

```bash
npm run dev
# Opens http://localhost:3000
```

### Build for Production

```bash
npm run build
# Generates src/data/photos.json

npm run preview
# Serves dist/ locally
```

### Development Workflow

1. Prepare photos with ingest script
2. Run build script to validate and aggregate
3. Dev server automatically reloads on file changes
4. Check map, hero, filters for correct display

## Testing

**27 tests** cover:
- ✅ HTML structure and elements
- ✅ CSS variables and styles
- ✅ Responsive design rules
- ✅ Accessibility features
- ✅ Map controls and filters
- ✅ Footer attribution
- ✅ Data loading

Run: `npm run test src/main.test.ts`

## Performance

- **First Paint**: <1s (dark background immediately)
- **Leaflet Load**: ~500ms (tiles from CDN)
- **Markers Render**: <200ms for 50 photos
- **Bundle Size**: ~150KB (Leaflet + app logic)

### Optimization Tips

- Images pre-compressed at ~300KB each
- CSS is ~10KB minified
- Lazy-load map tiles from CDN
- No server-side rendering needed (static)

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari 14+, Chrome Android 90+)

## Future Enhancements

- Clustering markers for large datasets
- Photo filtering by date range
- Search by space name
- User location detection (show nearby)
- Dark/light mode toggle
- Internationalization (English, etc.)

## Related

- **Data Model**: `src/types/types.ts`
- **Build Script**: `BUILD_GUIDE.md`
- **Ingest Script**: `INGEST_GUIDE.md`
- **Prototype**: `https://github.com/Lukather/igiardinidimilano/blob/prototype/landing-rough-take/`
