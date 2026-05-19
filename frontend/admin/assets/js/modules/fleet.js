import { classMap } from '../config.js';
import { escapeHtml } from '../utils.js';

// Status color mapping
const STATUS_COLOR = {
  active: '#16a34a', // green
  overdue: '#dc2626', // red
  idle: '#f59e0b', // amber
};

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function renderFleetModule({ data, query, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  host.innerHTML = `
    <header class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading}">Live Fleet Map</h2>
      </div>
      <div class="flex items-center gap-2">
        <button id="refreshFleetBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
      </div>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div id="fleetControls" class="mb-3 flex flex-wrap items-center gap-3"></div>
      <div id="fleetMapHost" class="h-[560px] w-full rounded-xl border border-slate-200 bg-white dark:bg-[#071018] dark:border-white/5"></div>
      <div id="fleetMapStatus" class="mt-3 text-sm text-slate-600"></div>
      <div id="fleetEmptyState" class="hidden mt-4">No active rentals found.</div>
    </section>
  `;

  const mapHost = host.querySelector('#fleetMapHost');
  const controlsHost = host.querySelector('#fleetControls');
  const emptyState = host.querySelector('#fleetEmptyState');
  const fleetMapStatus = host.querySelector('#fleetMapStatus');

  let map = null;
  let markers = new Map();
  let pollTimer = null;
  let lastFetchPromise = null;
  let preserveView = null;

  async function loadLeaflet() {
    if (window.L) return window.L;

    // inject css
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.leaflet = 'true';
      document.head.appendChild(link);
    }

    // inject script
    if (!document.querySelector('script[data-leaflet]')) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.async = true;
        s.dataset.leaflet = 'true';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Leaflet runtime'));
        document.head.appendChild(s);
      });
    }

    return window.L;
  }

  function createMarkerIcon(color) {
    const svg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 24"><path fill="${color}" stroke="#111" stroke-opacity="0.12" stroke-width="0.5" d="M12 2C8 2 5 5 5 9c0 6.5 7 13 7 13s7-6.5 7-13c0-4-3-7-7-7z"/></svg>
    `);
    return L.divIcon({
      className: 'vrs-marker',
      html: `<div class="marker-wrap"> <img src="data:image/svg+xml,${svg}" alt="marker" /> </div>`,
      iconSize: [28, 40],
      iconAnchor: [14, 40],
    });
  }

  function updateMarkers(rows) {
    if (!map || !Array.isArray(rows)) return;

    const seen = new Set();
    rows.forEach((row) => {
      const vid = String(row.vehicle_id || row.vehicleId || row.vehicleId || '');
      const lat = Number(row.latitude || 0);
      const lng = Number(row.longitude || 0);
      if (!vid || !isFinite(lat) || !isFinite(lng)) return;
      seen.add(vid);

      const status = String(row.status || 'active').toLowerCase();
      const color = STATUS_COLOR[status] || STATUS_COLOR.active;

      const existing = markers.get(vid);
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.getElement()?.querySelector('img')?.setAttribute('src', createMarkerIconSrc(color));
        existing.bindPopup(buildPopupHtml(row));
      } else {
        const icon = createMarkerIcon(color);
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(buildPopupHtml(row));
        markers.set(vid, marker);
      }
    });

    // remove markers no longer present
    Array.from(markers.keys()).forEach((k) => {
      if (!seen.has(k)) {
        const m = markers.get(k);
        if (m) {
          map.removeLayer(m);
        }
        markers.delete(k);
      }
    });
  }

  function createMarkerIconSrc(color) {
    const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C8 2 5 5 5 9c0 6.5 7 13 7 13s7-6.5 7-13c0-4-3-7-7-7z"/></svg>`);
    return `data:image/svg+xml,${svg}`;
  }

  function buildPopupHtml(row) {
    const vehicleName = String(row.vehicle_name || row.vehicleName || 'Vehicle');
    const bookingId = String(row.booking_id || row.bookingId || '');
    const customer = String(row.customer_name || row.customerName || '');
    const status = String(row.status || '').toUpperCase();
    const last = row.last_location_update || row.lastLocationUpdate || '';
    const started = row.rental_started_at || row.rentalStartedAt || '';
    const expected = row.expected_return_at || row.expectedReturnAt || '';

    return `<div class="text-sm">
      <div class="font-bold mb-1">${escapeHtml(vehicleName)}</div>
      <div class="text-xs text-slate-600">Booking: ${escapeHtml(bookingId || '-')}</div>
      <div class="text-xs text-slate-600">Customer: ${escapeHtml(customer || '-')}</div>
      <div class="text-xs text-slate-600">Status: <span class="font-semibold">${escapeHtml(status)}</span></div>
      <div class="text-xs text-slate-500">Started: ${escapeHtml(String(started || '-'))}</div>
      <div class="text-xs text-slate-500">Last update: ${escapeHtml(String(last || '-'))}</div>
    </div>`;
  }


  async function fetchFleetData() {
    if (lastFetchPromise) return lastFetchPromise;
    lastFetchPromise = (async () => {
      const client = await window.SupabaseClient.init();
      const resp = await client.rpc('get_active_fleet_tracking', { p_limit: 1000, p_offset: 0 });
      lastFetchPromise = null;
      if (resp.error) throw resp.error;
      return Array.isArray(resp.data) ? resp.data : [];
    })();
    return lastFetchPromise;
  }

  async function refresh() {
    try {
      const rows = await fetchFleetData();
      const withCoords = rows.filter(r => r && r.latitude != null && r.longitude != null);
      const withoutCoords = rows.length - withCoords.length;

      if (!rows.length || !withCoords.length) {
        mapHost.classList.add('hidden');
        emptyState.classList.remove('hidden');
        const msg = rows.length ? `${withoutCoords} active booking(s) have no location data.` : 'No active rentals found.';
        fleetMapStatus && (fleetMapStatus.textContent = msg + ' You can seed sample telemetry or enable device ingestion.');
        return;
      }

      emptyState.classList.add('hidden');
      mapHost.classList.remove('hidden');

      updateMarkers(withCoords);

      fleetMapStatus && (fleetMapStatus.textContent = `${withCoords.length} vehicle(s) showing on the map. ${withoutCoords ? withoutCoords + ' missing location.' : ''}`);

      // preserve view if user moved map; otherwise fit to bounds of available markers
      if (!preserveView && withCoords.length) {
        const latlngs = withCoords.map(r => [Number(r.latitude), Number(r.longitude)]);
        try {
          const bounds = L.latLngBounds(latlngs);
          map.fitBounds(bounds.pad(0.4));
        } catch (e) {
          const first = withCoords[0];
          if (first) map.setView([Number(first.latitude), Number(first.longitude)], 12);
        }
      }
    } catch (err) {
      notify && notify('Fleet refresh error: ' + (err && err.message ? err.message : ''), 'error');
    }
  }

  function setupControls(categories) {
    controlsHost.innerHTML = '';
    // status filter
    const statusSelect = document.createElement('select');
    statusSelect.className = 'rounded border px-2 py-1 text-sm';
    statusSelect.innerHTML = `<option value="">All statuses</option><option value="active">Active</option><option value="idle">Idle</option><option value="overdue">Overdue</option>`;
    controlsHost.appendChild(statusSelect);

    // category filter
    const catSelect = document.createElement('select');
    catSelect.className = 'rounded border px-2 py-1 text-sm';
    catSelect.innerHTML = `<option value="">All categories</option>${(Array.isArray(categories) ? categories : []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}`;
    controlsHost.appendChild(catSelect);

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search vehicle or booking ID...';
    search.className = 'rounded border px-2 py-1 text-sm';
    controlsHost.appendChild(search);

    const applyFilters = debounce(async () => {
      const status = statusSelect.value;
      const category = catSelect.value;
      const term = search.value.trim().toLowerCase();
      try {
        const rows = await fetchFleetData();
        const filtered = rows.filter(r => {
          if (status && String(r.status || '').toLowerCase() !== status) return false;
          if (category && String(r.category || '').toLowerCase() !== String(category).toLowerCase()) return false;
          if (term) {
            const name = String(r.vehicle_name || r.vehicleName || '').toLowerCase();
            const bid = String(r.booking_id || r.bookingId || '').toLowerCase();
            return name.indexOf(term) >= 0 || bid.indexOf(term) >= 0;
          }
          return true;
        });
        updateMarkers(filtered);
      } catch (err) {
        notify && notify('Filter error: ' + (err && err.message ? err.message : ''), 'error');
      }
    }, 350);

    statusSelect.addEventListener('change', applyFilters);
    catSelect.addEventListener('change', applyFilters);
    search.addEventListener('input', applyFilters);
  }

  // wire refresh button
  host.querySelector('#refreshFleetBtn')?.addEventListener('click', async () => {
    notify && notify('Refreshing fleet data...', 'info');
    await refresh();
    notify && notify('Fleet refreshed', 'success');
  });

  // initialize map and start polling
  (async function initMapAndPoll() {
    try {
      const L = await loadLeaflet();
      map = L.map(mapHost, {
        zoomControl: true,
        // Nepal bounding box: lat ~ [26,31], lon ~ [80,89]
        maxBounds: [[26, 80], [31, 89]],
        minZoom: 6,
        maxZoom: 18,
        worldCopyJump: false,
      });

      // prefer OpenStreetMap tiles but provide a fallback if tile requests fail (400/403)
      const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const cartoUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      function attachTileLayer(url, attribution) {
        const tl = L.tileLayer(url, { attribution, maxZoom: 19 });
        tl.addTo(map);
        tl.on('tileerror', function (err) {
          // switch to fallback once on error
          if (url === osmUrl) {
            try {
              map.eachLayer(function (layer) {
                if (layer && layer._url && layer._url.indexOf('openstreetmap') >= 0) map.removeLayer(layer);
              });
            } catch (e) {}
            attachTileLayer(cartoUrl, '&copy; OpenStreetMap contributors & CartoDB');
          }
        });
        return tl;
      }

      attachTileLayer(osmUrl, '&copy; OpenStreetMap contributors');

      // initial view: center Nepal (Kathmandu area) but allow bounds to keep focus on Nepal
      map.setView([27.7172, 85.3240], 7);

      // preserve user viewport when user interacts
      map.on('movestart', () => { preserveView = true; });

      // initial data
      const rows = await fetchFleetData();
      const categories = Array.from(new Set(rows.map(r => String(r.category || '').trim()).filter(Boolean))).slice(0, 20);
      setupControls(categories);
      updateMarkers(rows);

      // polling every 60s
      pollTimer = setInterval(() => refresh(), 60000);
    } catch (err) {
      notify && notify('Unable to initialize fleet map: ' + (err && err.message ? err.message : ''), 'error');
      mapHost.textContent = 'Unable to load map.';
    }
  })();

  // cleanup when module is removed (not strictly necessary in this SPA but good hygiene)
  host.cleanup = () => {
    if (pollTimer) clearInterval(pollTimer);
    if (map) map.remove();
    markers.clear();
  };

  return host;
}
