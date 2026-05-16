Admin KPI Tiles

This admin area includes customer behavior KPI tiles (Repeat Customers %, Avg Booking Window, Top Segment).

How it works:
- The admin UI requests KPI metrics from a backend endpoint at `http://localhost:3001/api/kpis`.
- Set up the backend service role key and start the KPI server as described in `backend/README.md`.
- Use the date range controls in the Reports -> Customer Behavior tab to refresh tiles.
# Admin Dashboard Module

This directory contains the enterprise-grade admin console for the Vehicle Rental System.

## Entry Point

- `index.html` - standalone dashboard shell using Tailwind CDN and modular ES scripts.

## JS Structure

- `assets/js/app.js` - bootstraps shell, routing, and module rendering.
- `assets/js/shell.js` - sidebar/top navigation, quick actions, and toasts.
- `assets/js/data.js` - in-memory seed data for all admin domains.
- `assets/js/modules/` - feature modules (overview, vehicles, bookings, customers, drivers, payments, pricing, maintenance, reviews, admins, notifications, reports).
- `assets/js/ui.js` - reusable modal/drawer/empty-state utilities.
- `assets/js/table-utils.js` - sorting, filtering, and pagination helpers.
- `assets/js/charts.js` - Chart.js wrapper utilities.

## Design Notes

- Desktop-first responsive layout with mobile sidebar and adaptive cards.
- Light/dark mode support with persistent state.
- Consistent card system, spacing, interaction states, and feedback toasts.
