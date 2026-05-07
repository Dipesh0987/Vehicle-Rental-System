import { classMap } from '../config.js';

export function renderFleetModule({ data, query, notify, catalogService, bookingService, customerVerificationService }) {
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
      <div id="fleetMapHost" class="h-[480px] w-full rounded-xl border border-slate-200 bg-white dark:bg-[#071018] dark:border-white/5"></div>
      <div id="fleetEmptyState" class="hidden mt-4">No active rentals found.</div>
    </section>
  `;

  // wire refresh
  host.querySelector('#refreshFleetBtn')?.addEventListener('click', async () => {
    notify('Refreshing fleet data...', 'info');
    try {
      await fetchFleetDataAndRender();
      notify('Fleet refreshed', 'success');
    } catch (err) {
      notify('Unable to refresh fleet data: ' + (err && err.message ? err.message : ''), 'error');
    }
  });

  // placeholder for fetch/render function that will be implemented in the next commit
  async function fetchFleetDataAndRender() {
    // Uses Supabase RPC get_active_fleet_tracking via window.SupabaseClient
    const client = await window.SupabaseClient.init();
    const resp = await client.rpc('get_active_fleet_tracking', { p_limit: 200, p_offset: 0 });
    if (resp.error) throw resp.error;
    const rows = Array.isArray(resp.data) ? resp.data : [];

    const hostMap = host.querySelector('#fleetMapHost');
    const empty = host.querySelector('#fleetEmptyState');
    if (!rows.length) {
      if (hostMap) hostMap.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (hostMap) hostMap.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');

    // Defer map rendering to map module commit
    hostMap.textContent = 'Fleet data loaded (' + rows.length + ') — map will render in the next update.';
  }

  // initial fetch
  fetchFleetDataAndRender().catch(() => {});

  return host;
}
