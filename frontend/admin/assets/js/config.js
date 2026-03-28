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

export const quickActions = [
  { id: 'newBooking', label: 'Create Booking', icon: 'calendar_plus_app' },
  { id: 'addVehicle', label: 'Add Vehicle', icon: 'directions_car' },
  { id: 'markMaintenance', label: 'Report Damage', icon: 'build_circle' },
];
