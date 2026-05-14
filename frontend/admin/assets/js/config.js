export const appConfig = {
  storageKeys: {
    theme: 'admin-theme-mode',
    sidebar: 'admin-sidebar-collapsed',
  },
  roles: ['Super Admin', 'Manager', 'Staff'],
  statuses: {
    active: 'Active',
    pending: 'Pending',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
  },
};

export const classMap = {
  panel:
    'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none',
  heading: 'text-[20px] font-extrabold tracking-[-0.02em]',
  muted: 'text-sm text-slate-500 dark:text-slate-400',
  tag: 'rounded-full px-2.5 py-1 text-xs font-semibold',
};

/**
 * Consistent segment colour palette used across overview and reporting charts.
 * Order matches the default fleetCategory / utilization arrays in data.js.
 */
export const SEGMENT_COLORS = {
  SUV:      '#f08f5f',
  Sedan:    '#1f7668',
  Bike:     '#5d90a5',
  Electric: '#e5bb5d',
  Luxury:   '#8f95b2',
};

/** Ordered array form for indexed chart datasets. */
export const SEGMENT_COLOR_LIST = Object.values(SEGMENT_COLORS);

export const quickActions = [
  { id: 'newBooking', label: 'Create Booking', icon: 'event_available' },
  { id: 'addVehicle', label: 'Add Vehicle', icon: 'directions_car' },
  { id: 'addDriver', label: 'Add Driver', icon: 'person_add' },
  { id: 'markMaintenance', label: 'Report Damage', icon: 'car_repair' },
];
