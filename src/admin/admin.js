/**
 * I Giardini di Milano - Admin Panel
 * 
 * Client-side JavaScript for photo upload UI.
 * Works with a local backend server (see admin-server.mjs)
 */

// ============================================================================
// STATE
// ============================================================================

let selectedFile = null;
let map = null;
let marker = null;
let selectedCoordinates = { latitude: null, longitude: null };

const MILAN_CENTER = [45.4642, 9.1900];
const MILAN_ZOOM = 12;

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const previewImg = document.getElementById('preview-img');
const previewName = document.getElementById('preview-name');
const clearFileBtn = document.getElementById('clear-file');
const exifData = document.getElementById('exif-data');
const mapContainer = document.getElementById('map');
const latInput = document.getElementById('lat-input');
const lonInput = document.getElementById('lon-input');
const updateCoordsBtn = document.getElementById('update-coords');
const dateInput = document.getElementById('date-input');
const categoryInput = document.getElementById('category-input');
const spaceInput = document.getElementById('space-input');
const descriptionInput = document.getElementById('description-input');
const descCount = document.getElementById('desc-count');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const statusEl = document.getElementById('status');

// ============================================================================
// FILE HANDLING
// ============================================================================

function handleFile(file) {
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showStatus('❌ Per favore seleziona un file immagine', 'error');
    return;
  }

  selectedFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewName.textContent = file.name;
    filePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);

  // Extract EXIF
  extractEXIF(file);

  // Update form
  updateFormState();
}

function clearFile() {
  selectedFile = null;
  filePreview.classList.add('hidden');
  exifData.classList.add('hidden');
  fileInput.value = '';
  selectedCoordinates = { latitude: null, longitude: null };
  updateFormState();
}

// Dropzone events
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

clearFileBtn.addEventListener('click', clearFile);

// ============================================================================
// EXIF EXTRACTION
// ============================================================================

async function extractEXIF(file) {
  try {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);

    // Look for EXIF marker (0xFFE1)
    let exifStart = -1;
    for (let i = 2; i < view.length - 1; i++) {
      if (view[i] === 0xff && view[i + 1] === 0xe1) {
        exifStart = i;
        break;
      }
    }

    if (exifStart === -1) {
      showExifStatus('❌ Nessun dato GPS trovato in EXIF', null);
      return;
    }

    // Try to extract GPS using a simple heuristic
    // Look for GPS tag (0x0002 = GPS IFD offset)
    let gpsData = null;

    // Simplified: just show that EXIF is present, extract date if possible
    showExifStatus('✓ Dati EXIF trovati', null);
  } catch (error) {
    console.error('EXIF extraction error:', error);
    showExifStatus('⚠️ Errore nella lettura EXIF', null);
  }
}

function showExifStatus(message, coords) {
  const exifDate = document.getElementById('exif-date');
  const exifGps = document.getElementById('exif-gps');

  exifDate.textContent = message;
  exifGps.textContent = coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : '—';

  if (message === '✓ Dati EXIF trovati' || coords) {
    exifData.classList.remove('hidden');
  }
}

// ============================================================================
// MAP
// ============================================================================

function initMap() {
  map = L.map(mapContainer).setView(MILAN_CENTER, MILAN_ZOOM);

  // Same basemap as the public site. tile.openstreetmap.org must never be
  // requested directly (see src/map-tiles.ts for the policy rationale and
  // the verified zoom limits); this file is served unbundled, so the config
  // is mirrored rather than imported.
  L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    minZoom: 10,
  }).addTo(map);

  // Click to set marker
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setMarker(lat, lng);
  });

  // Scroll zoom disabled by default (same as main site)
  map.scrollWheelZoom.disable();
  map.getContainer().addEventListener('mouseenter', () => map.scrollWheelZoom.enable());
  map.getContainer().addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  // If we have coordinates, show marker
  if (selectedCoordinates.latitude && selectedCoordinates.longitude) {
    setMarker(selectedCoordinates.latitude, selectedCoordinates.longitude);
  }
}

function setMarker(lat, lon) {
  selectedCoordinates.latitude = lat;
  selectedCoordinates.longitude = lon;

  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    marker = L.circleMarker([lat, lon], {
      radius: 8,
      fillColor: '#1a7f37',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map);
  }

  // Update input fields
  latInput.value = lat.toFixed(6);
  lonInput.value = lon.toFixed(6);

  // Center map on marker
  map.setView([lat, lon], Math.max(MILAN_ZOOM, map.getZoom()));

  updateFormState();
}

// Update marker from input fields
updateCoordsBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);

  if (isNaN(lat) || isNaN(lon)) {
    showStatus('❌ Coordinate non valide', 'error');
    return;
  }

  setMarker(lat, lon);
});

// ============================================================================
// FORM HANDLING
// ============================================================================

// Character count for description
descriptionInput.addEventListener('input', () => {
  const count = descriptionInput.value.length;
  descCount.textContent = `${count}/500`;

  if (count < 10 || count > 500) {
    descCount.classList.add('invalid');
  } else {
    descCount.classList.remove('invalid');
  }

  updateFormState();
});

// Set today's date by default
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
dateInput.value = `${yyyy}-${mm}-${dd}`;

// Reset button
resetBtn.addEventListener('click', () => {
  clearFile();
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  categoryInput.value = '';
  spaceInput.value = '';
  descriptionInput.value = '';
  descCount.textContent = '0/500';
  statusEl.classList.add('hidden');
  updateFormState();
});

// ============================================================================
// FORM VALIDATION & SUBMISSION
// ============================================================================

function updateFormState() {
  const isValid =
    selectedFile &&
    selectedCoordinates.latitude &&
    selectedCoordinates.longitude &&
    dateInput.value &&
    categoryInput.value &&
    spaceInput.value.trim() &&
    descriptionInput.value.length >= 10 &&
    descriptionInput.value.length <= 500;

  submitBtn.disabled = !isValid;
}

submitBtn.addEventListener('click', submitPhoto);

async function submitPhoto() {
  if (!selectedFile) {
    showStatus('❌ Seleziona una foto', 'error');
    return;
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('photo', selectedFile);
  formData.append('latitude', selectedCoordinates.latitude);
  formData.append('longitude', selectedCoordinates.longitude);
  formData.append('date', dateInput.value);
  formData.append('category', categoryInput.value);
  formData.append('space', spaceInput.value);
  formData.append('description', descriptionInput.value);

  try {
    showStatus('⏳ Caricamento in corso...', 'loading');
    submitBtn.disabled = true;

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    const indexNote =
      result.index > 1
        ? `\n(esisteva già una foto di questo spazio in questa data: assegnato l'indice ${String(result.index).padStart(2, '0')})`
        : '';

    const sizeNote = result.withinBudget
      ? `\nPeso: ${result.sizeKB}KB (budget ${result.targetSizeKB}KB)`
      : `\n⚠️ ${result.sizeKB}KB: non è stato possibile rientrare nel budget di ${result.targetSizeKB}KB senza scendere sotto la qualità minima.`;

    showStatus(
      `✓ Foto caricata! ID: ${result.photoId}${indexNote}${sizeNote}\n\nRicordati di eseguire: npm run build && git add . && git commit`,
      'success',
    );

    // Reset form
    setTimeout(() => {
      clearFile();
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      categoryInput.value = '';
      spaceInput.value = '';
      descriptionInput.value = '';
      descCount.textContent = '0/500';
      updateFormState();
    }, 1500);
  } catch (error) {
    showStatus(`❌ Errore: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    updateFormState();
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  updateFormState();
});
