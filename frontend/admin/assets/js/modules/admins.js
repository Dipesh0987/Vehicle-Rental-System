import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderAdminsModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.adminUsers, query, ['id', 'name', 'role']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Security</p>
        <h2 class="${classMap.heading}">Role-Based Admin Management</h2>
      </div>
      <button id="inviteAdminBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Invite Admin</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">User</th>
              <th class="pb-2 pr-3">Role</th>
              <th class="pb-2 pr-3">Permissions</th>
              <th class="pb-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3">
                    <p class="font-bold">${row.name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${row.id}</p>
                  </td>
                  <td class="py-3 pr-3"><span class="${roleClass(row.role)}">${row.role}</span></td>
                  <td class="py-3 pr-3">${row.permissions.join(', ')}</td>
                  <td class="py-3 pr-3"><button data-permission="${row.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-white/10">Edit Access</button></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  host.querySelector('#inviteAdminBtn')?.addEventListener('click', () => {
    notify('Admin invitation drawer opened', 'success');
  });

  host.querySelectorAll('[data-permission]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Permissions updated for ${button.getAttribute('data-permission')}`, 'info');
    });
  });

  return host;
}

function roleClass(role) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (role === 'Super Admin') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (role === 'Manager') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}
