/**
 * Activity Feed Service
 * Derives a unified, sorted activity feed from admin appState data and
 * provides a Supabase realtime subscription for maintenance_records.
 * (Booking realtime is already handled by the booking service.)
 */

export const ACTIVITY_TYPES = {
  'Booking Created': {
    icon: 'event_note',
    iconHex: '#1f7668',
    badgeCls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  },
  'Vehicle Returned': {
    icon: 'task_alt',
    iconHex: '#10b981',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  'Cancellation': {
    icon: 'cancel',
    iconHex: '#f59e0b',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  'Maintenance Alert': {
    icon: 'build_circle',
    iconHex: '#ef4444',
    badgeCls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  },
};

export function formatRelativeTime(iso) {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000)          return 'just now';
  if (diff < 3_600_000)       return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)      return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000)  return `${Math.floor(diff / 86_400_000)}d ago`;
  try { return new Date(ms).toLocaleDateString(); } catch (_) { return ''; }
}

/**
 * Derive a unified, deduplicated activity feed from appState data.
 * @param {object} data  – appState.data (bookings, maintenance, etc.)
 * @param {number} max   – maximum items to return (default 10)
 */
export function buildActivityFeed(data, max = 10) {
  const events = [];

  // ── Bookings ─────────────────────────────────────────────────────────
  for (const b of (Array.isArray(data.bookings) ? data.bookings : [])) {
    const status = String(b.status || '').toLowerCase();

    if (status === 'cancelled') {
      events.push({
        id:     `cancel-${b.bookingId || b.id}`,
        type:   'Cancellation',
        detail: `${b.id} cancelled by ${b.customer || 'customer'}`,
        ts:     b.createdAt || '',
        module: 'bookings',
      });
    } else if (status === 'completed') {
      events.push({
        id:     `return-${b.bookingId || b.id}`,
        type:   'Vehicle Returned',
        detail: `${b.vehicle || 'Vehicle'} returned — ${b.id}`,
        ts:     b.end || b.createdAt || '',
        module: 'bookings',
      });
    } else if (status === 'pending' || status === 'confirmed') {
      events.push({
        id:     `book-${b.bookingId || b.id}`,
        type:   'Booking Created',
        detail: `${b.id} booked by ${b.customer || 'customer'}`,
        ts:     b.createdAt || '',
        module: 'bookings',
      });
    }
  }

  // ── Maintenance ───────────────────────────────────────────────────────
  for (const m of (Array.isArray(data.maintenance) ? data.maintenance : [])) {
    const st      = String(m.status      || '').toLowerCase();
    const svcType = String(m.serviceType || '');

    if (svcType === 'Damage' || st === 'scheduled' || st === 'in progress') {
      const label = svcType === 'Damage'
        ? `Damage on ${m.vehicle || 'vehicle'} — ${m.id}`
        : `${svcType}: ${m.vehicle || 'vehicle'}`;
      events.push({
        id:     `maint-${m.id}`,
        type:   'Maintenance Alert',
        detail: label,
        ts:     m.schedule || '',
        module: 'maintenance',
      });
    }
  }

  // ── Sort newest-first, limit ──────────────────────────────────────────
  events.sort((a, b) =>
    (Date.parse(String(b.ts || '')) || 0) - (Date.parse(String(a.ts || '')) || 0)
  );

  return events.slice(0, max).map((e) => ({ ...e, time: formatRelativeTime(e.ts) }));
}

/**
 * Subscribe to INSERT/UPDATE events on maintenance_records via Supabase realtime.
 * Returns an unsubscribe function.
 */
export async function subscribeToMaintenanceChanges(handler) {
  if (!window.SupabaseClient?.isConfigured()) return () => {};
  try {
    const client  = await window.SupabaseClient.init();
    const channel = client
      .channel('admin-maint-activity-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_records' }, handler)
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch (_) {} };
  } catch (_) {
    return () => {};
  }
}
