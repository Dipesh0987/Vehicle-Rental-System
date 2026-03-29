export function renderEmptyState({ title, message, actionLabel, actionId }) {
  return `
    <div class="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center dark:border-white/20 dark:bg-white/5">
      <p class="text-base font-extrabold">${title}</p>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${message}</p>
      ${actionLabel ? `<button id="${actionId}" class="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">${actionLabel}</button>` : ''}
    </div>
  `;
}

export function ensureOverlayHost() {
  let host = document.getElementById('overlayHost');
  if (host) return host;

  host = document.createElement('div');
  host.id = 'overlayHost';
  host.className = 'fixed inset-0 z-[60] pointer-events-none';
  document.body.appendChild(host);
  return host;
}

export function openModal({ title, content, onConfirm }) {
  const host = ensureOverlayHost();
  host.innerHTML = `
    <div id="overlayBackdrop" class="pointer-events-auto absolute inset-0 bg-black/45"></div>
    <div class="pointer-events-auto absolute left-1/2 top-1/2 w-[92%] max-w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-[#151d22]">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-lg font-extrabold">${title}</h3>
        <button id="overlayClose" class="rounded-lg p-1.5 hover:bg-slate-900/10 dark:hover:bg-white/10">✕</button>
      </div>
      <div class="mt-3 text-sm text-slate-700 dark:text-slate-300">${content}</div>
      <div class="mt-5 flex justify-end gap-2">
        <button id="overlayCancel" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Cancel</button>
        <button id="overlayConfirm" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Confirm</button>
      </div>
    </div>
  `;

  const close = () => {
    host.innerHTML = '';
  };

  host.querySelector('#overlayClose')?.addEventListener('click', close);
  host.querySelector('#overlayCancel')?.addEventListener('click', close);
  host.querySelector('#overlayBackdrop')?.addEventListener('click', close);
  host.querySelector('#overlayConfirm')?.addEventListener('click', () => {
    onConfirm?.();
    close();
  });
}

export function openDrawer({ title, content }) {
  const host = ensureOverlayHost();
  host.innerHTML = `
    <div id="overlayBackdrop" class="pointer-events-auto absolute inset-0 bg-black/45"></div>
    <aside class="pointer-events-auto absolute right-0 top-0 h-full w-[92%] max-w-[480px] border-l border-slate-200 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-[#151d22]">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-lg font-extrabold">${title}</h3>
        <button id="overlayClose" class="rounded-lg p-1.5 hover:bg-slate-900/10 dark:hover:bg-white/10">✕</button>
      </div>
      <div class="scroll-thin mt-3 h-[calc(100%-3.4rem)] overflow-y-auto text-sm text-slate-700 dark:text-slate-300">${content}</div>
    </aside>
  `;

  const close = () => {
    host.innerHTML = '';
  };

  host.querySelector('#overlayClose')?.addEventListener('click', close);
  host.querySelector('#overlayBackdrop')?.addEventListener('click', close);
}
