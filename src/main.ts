/**
 * I Giardini di Milano - Main Application
 *
 * Renders the landing page with:
 * - Split-screen hero (Variant B)
 * - Map with Leaflet
 * - Category filters
 * - Statistics
 */

// Leaflet ships as a dependency and is bundled here: loading it from a CDN as
// well would download the same library twice. Its stylesheet is imported so
// the build emits it once, before the site's own rules (see main.css, which
// overrides some Leaflet defaults).
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import L from 'leaflet';
import type { SiteData, Photo } from './types/types';
import { MAP_TILES } from './map-tiles';
import { createPopupElement } from './popup';
import { CATEGORY_MODIFIER, markerIconHtml } from './category';

// ============================================================================
// CONSTANTS
// ============================================================================

const MILAN_CENTER: [number, number] = [45.4642, 9.1900];
const MILAN_ZOOM = 12;

// ============================================================================
// STATE
// ============================================================================

let siteData: SiteData | null = null;
let map: L.Map | null = null;
let markers: L.Marker[] = [];
let activeFilters = {
  curato: true,
  'in degrado': true,
};

// ============================================================================
// LOAD DATA
// ============================================================================

/**
 * Load site data from built JSON file
 */
async function loadSiteData(): Promise<SiteData> {
  try {
    const response = await fetch('./data/photos.json');
    if (!response.ok) {
      throw new Error(`Failed to load photos.json: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading site data:', error);
    throw error;
  }
}

// ============================================================================
// HERO SECTION
// ============================================================================

/**
 * Initialize hero section with sample curato and degraded photos
 */
function initHero(data: SiteData): void {
  const curatedPhotos = data.photos.filter((p) => p.category === 'curato');
  const degradedPhotos = data.photos.filter((p) => p.category === 'in degrado');

  // Select first curated and degraded photo
  const curatedPhoto = curatedPhotos[0];
  const degradedPhoto = degradedPhotos[0];

  if (curatedPhoto) {
    const curatedImg = document.getElementById('hero-curato-img') as HTMLImageElement;
    curatedImg.src = `./photos/${curatedPhoto.imageFile}`;
    curatedImg.alt = `${curatedPhoto.space} (curato): ${curatedPhoto.description}`;
  }

  if (degradedPhoto) {
    const degradedImg = document.getElementById('hero-degraded-img') as HTMLImageElement;
    degradedImg.src = `./photos/${degradedPhoto.imageFile}`;
    degradedImg.alt = `${degradedPhoto.space} (in degrado): ${degradedPhoto.description}`;
  }

  // Update statistics
  updateStats(data.stats);
}

/**
 * Update statistics display
 */
function updateStats(stats: { totalPhotos: number; curatedSpaces: number; degradedSpaces: number }): void {
  const totalEl = document.getElementById('stat-total');
  const curatedEl = document.getElementById('stat-curato');
  const degradedEl = document.getElementById('stat-degraded');

  if (totalEl) totalEl.textContent = stats.totalPhotos.toString();
  if (curatedEl) curatedEl.textContent = stats.curatedSpaces.toString();
  if (degradedEl) degradedEl.textContent = stats.degradedSpaces.toString();
}

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

/**
 * Initialize Leaflet map
 */
function initMap(): L.Map {
  // Create map centered on Milan.
  // scrollWheelZoom starts disabled so that scrolling the page past the map
  // doesn't get hijacked into zooming; see enableCtrlWheelZoom() below.
  const map = L.map('map', {
    scrollWheelZoom: false,
  }).setView(MILAN_CENTER, MILAN_ZOOM);

  // Basemap from a keyless OSM-derived CDN (see map-tiles.ts for the policy
  // rationale and the verified zoom limits).
  L.tileLayer(MAP_TILES.url, {
    attribution: MAP_TILES.attribution,
    ...(MAP_TILES.subdomains ? { subdomains: MAP_TILES.subdomains } : {}),
    minZoom: MAP_TILES.minZoom,
    maxZoom: MAP_TILES.maxZoom,
    detectRetina: MAP_TILES.detectRetina,
  }).addTo(map);

  enableCtrlWheelZoom(map);

  // Fix sizing issues caused by the map being laid out before its
  // container reaches full size (common on initial load).
  setTimeout(() => map.invalidateSize(), 200);

  return map;
}

/**
 * Zoom with CTRL + wheel (or a trackpad pinch) only.
 *
 * A plain wheel never zooms the map: the page keeps scrolling past it, which
 * is what a visitor scrolling through the site expects. CTRL + wheel zooms,
 * and browsers report trackpad pinch gestures as CTRL + wheel events, so
 * pinch-to-zoom works too.
 *
 * Implementation: Leaflet's own handler stays disabled and is switched on for
 * the duration of a CTRL wheel event from a capture-phase listener, so it runs
 * before Leaflet's bubble-phase one on the same container. That reuses
 * Leaflet's tuned behaviour — debounce for high-resolution trackpads, zoom
 * animation, zoom limits, zoom anchored under the cursor — instead of
 * reimplementing the wheel-delta maths.
 */
function enableCtrlWheelZoom(map: L.Map): void {
  map.getContainer().addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (!event.ctrlKey) {
        map.scrollWheelZoom.disable();
        return;
      }
      map.scrollWheelZoom.enable();
      // Also stop the browser's own CTRL + wheel page zoom, in case the wheel
      // event is the first one and Leaflet's handler is only now attached.
      event.preventDefault();
    },
    { capture: true, passive: false }
  );
}

// ============================================================================
// MARKERS
// ============================================================================

/**
 * Create a circle marker for a photo
 */
function createMarker(photo: Photo): L.Marker {
  const { coordinates, category } = photo;

  // The marker carries the category through three channels: colour, symbol and
  // border style. Colour alone would be lost in grayscale or for a colour-blind
  // visitor (see category.ts).
  const marker = L.marker([coordinates.latitude, coordinates.longitude], {
    icon: L.divIcon({
      className: `marker marker--${CATEGORY_MODIFIER[category]}`,
      html: markerIconHtml(category),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -12],
    }),
    // `title` is applied to the icon element by Leaflet (unlike `alt`, which
    // only affects img icons); the category is also spelled out in the popup.
    title: `${photo.space} — ${category}`,
    keyboard: true,
  });

  // Popup content is built as DOM nodes, so metadata can never be parsed as
  // markup (see popup.ts).
  marker.bindPopup(createPopupElement(photo), {
    maxWidth: 350,
  });

  return marker;
}

/**
 * Add all markers to map
 */
function addMarkersToMap(data: SiteData, map: L.Map): L.Marker[] {
  const markers: L.Marker[] = [];

  for (const photo of data.photos) {
    const marker = createMarker(photo);
    marker.addTo(map);
    markers.push(marker);
  }

  return markers;
}

/**
 * Update marker visibility based on filters
 */
function updateMarkersVisibility(data: SiteData, markers: L.Marker[]): void {
  if (!map) return;

  for (let i = 0; i < data.photos.length; i++) {
    const photo = data.photos[i];
    const marker = markers[i];
    const shouldShow = activeFilters[photo.category];

    if (shouldShow) {
      if (!map.hasLayer(marker)) {
        marker.addTo(map);
      }
    } else {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }
  }
}

// ============================================================================
// FILTERS
// ============================================================================

/**
 * Initialize filter controls
 */
function initFilters(data: SiteData): void {
  const filterCheckboxes = document.querySelectorAll('.filter-checkbox') as NodeListOf<HTMLInputElement>;

  filterCheckboxes.forEach((checkbox) => {
    const value = checkbox.value as 'curato' | 'in degrado';
    checkbox.checked = activeFilters[value];

    checkbox.addEventListener('change', () => {
      activeFilters[value] = checkbox.checked;
      updateMarkersVisibility(data, markers);
    });
  });
}

// ============================================================================
// POPUP STYLES (inject into document)
// ============================================================================

/**
 * Add styles for photo popups and map interactions
 */
function injectPopupStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .photo-popup {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #1a1a1a;
    }

    .photo-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 15px;
      font-weight: 600;
    }

    .photo-popup-category {
      font-size: 12px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .photo-popup-category--curato {
      color: #1a7f37;
    }

    .photo-popup-category--degraded {
      color: #c0392b;
    }

    .photo-popup-description {
      font-size: 14px;
      line-height: 1.5;
      margin: 8px 0;
      color: #333;
    }

    .photo-popup-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #666;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e5e5;
    }

    .photo-popup-date,
    .photo-popup-coords {
      display: flex;
      gap: 4px;
    }

    .photo-popup-date::before {
      content: "📅";
      font-size: 10px;
    }

    .photo-popup-coords::before {
      content: "📍";
      font-size: 10px;
    }

    /* Prevent page scroll interference with map zoom */
    .leaflet-container {
      touch-action: pinch-zoom;
    }

    .leaflet-popup-tip {
      background: #fff;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Main initialization
 */
async function init(): Promise<void> {
  console.log('🌱 I Giardini di Milano - Initializing...');

  try {
    // Load data
    console.log('📂 Loading site data...');
    siteData = await loadSiteData();
    console.log(`✅ Loaded ${siteData.photos.length} photos`);

    // Initialize hero
    console.log('🎨 Initializing hero...');
    initHero(siteData);

    // Initialize map
    console.log('🗺️  Initializing map...');
    map = initMap();

    // Add markers
    console.log('📍 Adding markers...');
    markers = addMarkersToMap(siteData, map);
    console.log(`✅ Added ${markers.length} markers`);

    // Initialize filters
    console.log('🔍 Initializing filters...');
    initFilters(siteData);

    // Inject popup styles
    injectPopupStyles();

    console.log('✨ Ready!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    // Show error message to user
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #0e0e0e;
          color: #f2f2f2;
          font-family: system-ui, sans-serif;
          text-align: center;
          padding: 20px;
        ">
          <div>
            <h1 style="margin-bottom: 16px;">Errore durante il caricamento</h1>
            <p style="color: #ccc; margin-bottom: 20px;">Impossibile caricare il sito. Assicurati che i dati delle foto siano stati generati con 'npm run build'.</p>
            <code style="
              display: block;
              background: #1a1a1a;
              padding: 12px;
              border-radius: 6px;
              font-size: 13px;
              color: #35a653;
            ">npm run build</code>
          </div>
        </div>
      `;
    }
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
