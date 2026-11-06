/**
 * The public upload form.
 *
 * Client-side checks exist to give fast feedback, never to protect anything:
 * the Worker re-validates every field and the file itself, because anything
 * that reaches it can come from a script instead of this page.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { resolveSitekey } from './src/sitekey';

const MILAN_CENTER: L.LatLngTuple = [45.4642, 9.19];
const MILAN_ZOOM = 12;

const SITEKEY = resolveSitekey(import.meta.env.VITE_TURNSTILE_SITEKEY);

interface TurnstileApi {
  render(element: HTMLElement, options: { sitekey: string; theme?: string }): string;
  reset(widgetId: string): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Elemento mancante: ${id}`);
  }
  return element as T;
}

const form = byId<HTMLFormElement>('upload-form');
const photoInput = byId<HTMLInputElement>('photo-input');
const photoHint = byId<HTMLSpanElement>('photo-hint');
const preview = byId<HTMLImageElement>('photo-preview');
const latitudeInput = byId<HTMLInputElement>('latitude');
const longitudeInput = byId<HTMLInputElement>('longitude');
const coordsStatus = byId<HTMLParagraphElement>('coords-status');
const descriptionInput = byId<HTMLTextAreaElement>('description');
const descCount = byId<HTMLSpanElement>('desc-count');
const dateInput = byId<HTMLInputElement>('date');
const declaration = byId<HTMLInputElement>('declaration');
const submitButton = byId<HTMLButtonElement>('submit');
const statusEl = byId<HTMLParagraphElement>('status');
const turnstileContainer = byId<HTMLDivElement>('turnstile');

// ---------------------------------------------------------------------------
// Map: the uploader places the pin. Without EXIF GPS nobody else can know.
// ---------------------------------------------------------------------------

const map = L.map('map', { scrollWheelZoom: false }).setView(MILAN_CENTER, MILAN_ZOOM);

L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

let marker: L.CircleMarker | null = null;

map.on('click', (event: L.LeafletMouseEvent) => {
  const { lat, lng } = event.latlng;

  if (marker) {
    marker.setLatLng(event.latlng);
  } else {
    marker = L.circleMarker(event.latlng, {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1a7f37',
      fillOpacity: 1,
    }).addTo(map);
  }

  latitudeInput.value = lat.toFixed(6);
  longitudeInput.value = lng.toFixed(6);
  coordsStatus.textContent = `Posizione scelta: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  coordsStatus.classList.add('is-set');
  updateSubmitState();
});

// ---------------------------------------------------------------------------
// Photo preview
// ---------------------------------------------------------------------------

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];

  if (!file) {
    preview.hidden = true;
    return;
  }

  photoHint.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  updateSubmitState();
});

// ---------------------------------------------------------------------------
// Small form behaviours
// ---------------------------------------------------------------------------

descriptionInput.addEventListener('input', () => {
  descCount.textContent = `${descriptionInput.value.length}/500`;
});

declaration.addEventListener('change', updateSubmitState);

/** The button is enabled only when the three things we cannot infer are set. */
function updateSubmitState(): void {
  const ready =
    Boolean(photoInput.files?.[0]) &&
    Boolean(latitudeInput.value) &&
    Boolean(longitudeInput.value) &&
    declaration.checked;

  submitButton.disabled = !ready;
}

// Today, in local time: `toISOString()` would shift the date across midnight.
const today = new Date();
const localToday = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');
dateInput.value = localToday;
dateInput.max = localToday;

// ---------------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------------

let widgetId: string | null = null;

function loadTurnstile(): void {
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!api) {
      showStatus('Non è stato possibile caricare la verifica anti-bot. Ricarica la pagina.', 'error');
      return;
    }
    widgetId = api.render(turnstileContainer, { sitekey: SITEKEY, theme: 'light' });
  };
  script.onerror = () => {
    showStatus('Non è stato possibile caricare la verifica anti-bot. Ricarica la pagina.', 'error');
  };
  document.head.appendChild(script);
}

loadTurnstile();

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

function showStatus(message: string, kind: 'error' | 'success' | 'info' = 'info'): void {
  statusEl.textContent = message;
  statusEl.className = `status${kind === 'info' ? '' : ` is-${kind}`}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  submitButton.disabled = true;
  showStatus('Invio in corso…');

  try {
    const response = await fetch('/api/upload', { method: 'POST', body: new FormData(form) });
    const result = (await response.json().catch(() => ({}))) as { error?: string; id?: string };

    if (!response.ok) {
      showStatus(result.error ?? 'Non è stato possibile inviare la foto. Riprova.', 'error');
      return;
    }

    showStatus(
      'Foto ricevuta. La esamineremo e, se rispetta le regole, la vedrai presto sulla mappa.\n' +
        'Grazie per aver contribuito.',
      'success',
    );

    form.reset();
    dateInput.value = localToday;
    preview.hidden = true;
    photoHint.textContent = 'Tocca per scegliere una foto · JPEG, PNG o WebP · max 15 MB';
    descCount.textContent = '0/500';
    coordsStatus.textContent = 'Nessuna posizione scelta';
    coordsStatus.classList.remove('is-set');
    marker?.remove();
    marker = null;

    // Turnstile tokens are single-use: a second submission needs a new one.
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (api && widgetId) {
      api.reset(widgetId);
    }
  } catch {
    showStatus('Non è stato possibile inviare la foto. Controlla la connessione e riprova.', 'error');
  } finally {
    updateSubmitState();
  }
});

updateSubmitState();
