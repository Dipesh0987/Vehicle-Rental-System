/**
 * maintenance.service.js
 * ---------------------------------------------------------------------------
 * Data-access layer for the admin workshop summary cards and maintenance
 * table.  Provides:
 *   • fetchSummaryCounts()  – three aggregate counts used by the cards
 *   • fetchList()           – full maintenance list (hydration)
 *   • subscribeToChanges()  – Supabase Realtime channel for live updates
 *   • mapDbRow()            – normalise a Supabase row into the UI shape
 */

const TABLE = 'maintenance_records';

const STATUS_UPCOMING   = 'Scheduled';
const STATUS_IN_WORKSHOP = 'In Progress';
const DAMAGE_TYPE        = 'Damage';
const CLOSED_STATUSES    = ['Completed', 'Cancelled', 'Billed'];

/* ── helpers ──────────────────────────────────────────────────────────── */

function getClient() {
  if (!window.SupabaseClient || !window.SupabaseClient.isConfigured()) return null;
  return window.SupabaseClient.init();
}

/**
 * Map a raw Supabase row into the shape the maintenance module expects.
 */
export function mapDbRow(r) {
  return {
    dbId:            r.id,
    id:              r.maintenance_id,
    vehicle:         r.vehicle_name,
    vehicleId:       r.vehicle_id || '',
    schedule:        r.schedule_date,
    serviceType:     r.service_type,
    damage:          r.description,
    status:          r.status,
    costEstimate:    r.cost_estimate ? Number(r.cost_estimate) : 0,
    technician:      r.technician || '',
    reportedBy:      r.reported_by || '',
    completedAt:     r.completed_at || '',
    notes:           r.notes || '',
    customerName:    r.customer_name || '',
    customerEmail:   r.customer_email || '',
    customerUserId:  r.customer_user_id || '',
    linkedBookingId: r.linked_booking_id || '',
    bookingRef:      r.booking_ref || '',
  };
}

/* ── fetchSummaryCounts ───────────────────────────────────────────────── */

/**
 * Returns { upcoming, inWorkshop, damageClaimsOpen } from the database.
 * Uses three lightweight count-only queries (no row transfer).
 */
export async function fetchSummaryCounts() {
  const client = await getClient();
  if (!client) return null;

  const [upcomingRes, workshopRes, damageRes] = await Promise.all([
    client
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', STATUS_UPCOMING),
    client
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', STATUS_IN_WORKSHOP),
    client
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('service_type', DAMAGE_TYPE)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`),
  ]);

  return {
    upcoming:         upcomingRes.count ?? 0,
    inWorkshop:       workshopRes.count ?? 0,
    damageClaimsOpen: damageRes.count   ?? 0,
  };
}

/* ── fetchList ────────────────────────────────────────────────────────── */

/**
 * Full list fetch — used during hydration and forced reloads.
 * Returns an array of UI-shaped rows.
 */
export async function fetchList({ limit = 300 } = {}) {
  const client = await getClient();
  if (!client) return null;

  const { data: rows, error } = await client
    .from(TABLE)
    .select('*')
    .order('schedule_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(rows) ? rows.map(mapDbRow) : [];
}

/* ── subscribeToChanges ───────────────────────────────────────────────── */

/**
 * Opens a Supabase Realtime channel on maintenance_records.
 * Calls `onChange(eventType, newRow, oldRow)` for every INSERT / UPDATE /
 * DELETE event.  Returns an unsubscribe function.
 */
export async function subscribeToChanges(onChange) {
  const client = await getClient();
  if (!client) return () => {};

  const channel = client
    .channel('admin-maintenance-rt')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = payload.eventType; // INSERT | UPDATE | DELETE
        const newRow = payload.new ? mapDbRow(payload.new) : null;
        const oldRow = payload.old ? mapDbRow(payload.old) : null;
        onChange(eventType, newRow, oldRow);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
