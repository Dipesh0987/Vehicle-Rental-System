export const dashboardData = {
  metrics: {
    totalVehicles: 0,
    activeRentals: 0,
    dailyBookings: 0,
    revenue: 0,
    cancellations: 0,
  },
  revenueTrend: [],
  fleetCategory: [],
  utilization: [],
  activities: [],
  vehicles: [],
  bookings: [],
  customers: [],
  drivers: [],
  payments: [],
  promotions: [
    { code: 'WEEKEND20', type: 'Weekend', discount: '20%', active: true },
    { code: 'ECO15', type: 'Electric Fleet', discount: '15%', active: true },
    { code: 'LUX10', type: 'Luxury', discount: '10%', active: false },
  ],
  maintenance: [],
  reviews: [
    { id: 'R-21', customer: 'Sara Mills', rating: 5, feedback: 'Pickup was smooth and fast.', moderated: true },
    { id: 'R-22', customer: 'Rohit Shah', rating: 3, feedback: 'Vehicle was good but return queue was long.', moderated: false },
    { id: 'R-23', customer: 'Mia Cooper', rating: 4, feedback: 'Great support from desk team.', moderated: true },
  ],
  adminUsers: [
    { id: 'U-11', name: 'Ariana Gray', role: 'Super Admin', permissions: ['All'] },
    { id: 'U-12', name: 'Daniel Kim', role: 'Manager', permissions: ['Bookings', 'Vehicles', 'Reports'] },
    { id: 'U-13', name: 'Rita Sen', role: 'Staff', permissions: ['Bookings'] },
  ],
  notifications: [
    { id: 'N-1', title: 'New booking BK-4984', channel: 'In-app', priority: 'High', time: 'Just now' },
    { id: 'N-2', title: 'Return overdue BK-4948', channel: 'SMS', priority: 'Critical', time: '8 min ago' },
    { id: 'N-3', title: 'Cancellation BK-4980', channel: 'Email', priority: 'Medium', time: '16 min ago' },
  ],
};
