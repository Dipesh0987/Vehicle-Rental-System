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
