/**
 * I Giardini di Milano - Main Application
 *
 * Renders the landing page with:
 * - Split-screen hero (Variant B)
 * - Map with Leaflet
 * - Category filters
 * - Statistics
 */

import L from 'leaflet';
import type { SiteData, Photo } from './types/types';
import { MAP_TILES } from './map-tiles';
import { createPopupElement } from './popup';

// ============================================================================
// CONSTANTS
// ============================================================================

const MILAN_CENTER: [number, number] = [45.4642, 9.1900];
const MILAN_ZOOM = 12;

// Color scheme
const COLORS = {
  curato: '#1a7f37',
  degraded: '#c0392b',
};

// ============================================================================
// STATE
// ============================================================================

let siteData: SiteData | null = null;
let map: L.Map | null = null;
let markers: L.CircleMarker[] = [];
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
  // doesn't get hijacked into zooming; it's enabled once the user actively
  // engages with the map (click) and disabled again when they leave it.
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

  // Enable scroll-to-zoom only while the cursor is over the map, so page
  // scroll works normally everywhere else. This improves UX when scrolling
  // through the page past the map section.
  map.on('click', () => map.scrollWheelZoom.enable());
  map.getContainer().addEventListener('mouseenter', () => map.scrollWheelZoom.enable());
  map.getContainer().addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  // Fix sizing issues caused by the map being laid out before its
  // container reaches full size (common on initial load).
  setTimeout(() => map.invalidateSize(), 200);

  return map;
}

// ============================================================================
// MARKERS
// ============================================================================

/**
 * Create a circle marker for a photo
 */
function createMarker(photo: Photo): L.CircleMarker {
  const { coordinates, category } = photo;
  const color = category === 'curato' ? COLORS.curato : COLORS.degraded;

  // Circle marker with white ring for accessibility
  const marker = L.circleMarker([coordinates.latitude, coordinates.longitude], {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.8,
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
function addMarkersToMap(data: SiteData, map: L.Map): L.CircleMarker[] {
  const markers: L.CircleMarker[] = [];

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
function updateMarkersVisibility(data: SiteData, markers: L.CircleMarker[]): void {
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
