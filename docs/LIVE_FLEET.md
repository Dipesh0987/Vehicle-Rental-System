Live Fleet Map
================

Overview
--------
This module provides a real-time fleet map inside the Admin Operations area. It displays active rentals with color-coded markers and supports filtering, search and periodic polling.

Supabase Setup
--------------
1. Run the SQL migration `database/migrations/021_live_fleet_tracking.sql` in your Supabase SQL editor. This will:
   - Create `vehicle_locations` table for telemetry.
   - Create a `public.active_fleet_tracking` view and `public.get_active_fleet_tracking()` RPC.

2. Push vehicle location updates to `vehicle_locations` table from your device telemetry or IoT pipeline. Minimal column set:
   - `vehicle_id` (UUID)
   - `latitude` (double precision)
   - `longitude` (double precision)
   - `recorded_at` (timestamptz)

3. Ensure your Supabase anon key and URL are available to the admin frontend (see `frontend/assets/js/supabase.config.js` or create `supabase.config.local.js`).

How it works
------------
- Frontend calls `rpc('get_active_fleet_tracking')` to fetch normalized active rental rows.
- Map markers are rendered with Leaflet (loaded dynamically) and updated every 60 seconds.
- Marker colors: green=active, red=overdue, amber=idle.

Notes
-----
- The migration creates a `vehicle_locations` table — if you already have telemetry storage, adapt the view/RPC to use your table.
- For production, secure RPC access via RLS/policies or server-side proxy if needed.
