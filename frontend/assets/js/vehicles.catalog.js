(function () {
  'use strict';

  var fallbackImage = 'assets/images/car-transparent.png';

  function extractVehicle(row) {
    return {
      id: row.id,
      name: row.name || 'Vehicle',
      category: row.category || 'General',
      status: row.status || 'Available',
      daily: Number(row.daily || 0),
      image: row.image || fallbackImage,
    };
  }

  function buildSlug(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function formatPrice(value) {
    return '$' + Number(value || 0).toFixed(0) + ' / day';
  }

  function renderVehicles(vehicles) {
    var host = document.querySelector('.fleet-grid');
    if (!host || !vehicles.length) return;

    host.innerHTML = vehicles
      .map(function (vehicle, index) {
        var brand = vehicle.name.split(' ')[0] || 'Brand';
        var detailsId = vehicle.id || buildSlug(vehicle.name);
        var delay = 60 + index * 60;

        return '<article class="group rounded-[22px] border border-[#d8e2de] bg-white/90 p-3 opacity-0 shadow-[0_14px_30px_rgba(10,31,34,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_36px_rgba(10,31,34,0.16)] animate-cardLift" style="animation-delay:' + delay + 'ms">'
          + '<div class="overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#eef3f1,#dde8e4)]">'
          + '<img src="' + escapeHtml(vehicle.image) + '" alt="' + escapeHtml(vehicle.name) + '" class="h-[170px] w-full object-contain p-2 transition duration-500 group-hover:scale-[1.03]" />'
          + '</div>'
          + '<div class="pt-3">'
          + '<p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-panel">' + escapeHtml(brand) + '</p>'
          + '<h3 class="mt-1 text-[20px] font-bold text-ink">' + escapeHtml(vehicle.name) + '</h3>'
          + '<p class="mt-1 text-[13px] text-[#436164]">' + escapeHtml(vehicle.category) + ' • ' + escapeHtml(vehicle.status) + ' • ' + escapeHtml(formatPrice(vehicle.daily)) + '</p>'
          + '<div class="mt-3 flex items-center justify-between">'
          + '<a href="vehicle-details.html?id=' + encodeURIComponent(detailsId) + '" class="rounded-full border border-[#cfdad5] px-4 py-2 text-[12px] font-semibold text-[#284548] transition duration-200 hover:-translate-y-[1px] hover:border-[#2c766e]/40 hover:bg-[#f6faf8]">Show Details</a>'
          + '<button type="button" class="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_18px_rgba(229,140,78,0.28)]">Book Now</button>'
          + '</div>'
          + '</div>'
          + '</article>';
      })
      .join('');
  }

  async function hydrateVehiclesFromDatabase() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') return;
    if (!window.SupabaseClient.isConfigured()) return;

    try {
      var client = await window.SupabaseClient.init();
      var response = await client
        .from('vehicles')
        .select('id,name,category,status,daily,image')
        .order('updated_at', { ascending: false });

      if (response.error) {
        response = await client
          .from('vehicles')
          .select('id,name,category,status,daily,image')
          .order('id', { ascending: true });
      }

      if (response.error || !Array.isArray(response.data) || !response.data.length) {
        return;
      }

      renderVehicles(response.data.map(extractVehicle));
    } catch (error) {
      console.error('Vehicles DB hydration failed:', error);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateVehiclesFromDatabase, { once: true });
  } else {
    hydrateVehiclesFromDatabase();
  }
})();
