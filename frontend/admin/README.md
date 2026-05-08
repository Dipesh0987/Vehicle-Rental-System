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

## Customer Verification Workflow

- Customers module now hydrates live records from `public.user_profiles`.
- Verification statuses follow: `not_submitted`, `pending`, `approved`, `rejected`.
- Admin actions (`Approve`, `Reject`, `Set Pending`) call RPC `admin_update_user_verification_status`.
- Customer trip counts are dynamically merged from booking records.

## Global Search

- The top-bar search is now a shared admin search surface.
- Results are grouped by entity type: bookings, customers, invoices, and vehicles.
- Selecting a result deep-links into the matching record detail page and clears the search query.
- The search panel closes on outside click or `Escape`.

## Vehicle Bulk Add

- In Vehicle Management, the Add Vehicle drawer now supports bulk creation.
- Use one row per vehicle in the `Bulk Add Multiple Vehicles` textarea.
- Expected format:

```text
name|vehicleNumber|type|fuelType|seats|dailyPrice|status(optional)|transmission(optional)|location(optional)|features(optional)
```

- When bulk rows are provided, single-vehicle form fields are ignored for that submission.
- Bulk add uses catalog save mode and creates each row sequentially with validation per line.
