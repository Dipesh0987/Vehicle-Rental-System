-- Migration: 021_live_fleet_tracking.sql
-- Adds vehicle_locations table and an RPC to return active fleet tracking data

-- Create table for vehicle location telemetry
CREATE TABLE IF NOT EXISTS public.vehicle_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'device',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index to fetch latest location per vehicle quickly
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_recorded_at ON public.vehicle_locations (vehicle_id, recorded_at DESC);

-- A view simplifying active fleet join between vehicle_bookings and latest location
CREATE OR REPLACE VIEW public.active_fleet_tracking AS
SELECT
  vb.id AS booking_id,
  vb.vehicle_id,
  COALESCE(v.name, vb.vehicle_id::text) AS vehicle_name,
  COALESCE(v.category, '') AS category,
  vb.customer_name,
  vb.start_date AS rental_started_at,
  vb.end_date AS expected_return_at,
  vl.latitude,
  vl.longitude,
  vl.recorded_at AS last_location_update,
  CASE
    WHEN now() > vb.end_date THEN 'overdue'
    WHEN now() - vl.recorded_at > interval '15 minutes' THEN 'idle'
    ELSE 'active'
  END AS status
FROM public.vehicle_bookings vb
LEFT JOIN LATERAL (
  SELECT latitude, longitude, recorded_at
  FROM public.vehicle_locations vl2
  WHERE vl2.vehicle_id = vb.vehicle_id
  ORDER BY vl2.recorded_at DESC
  LIMIT 1
) vl ON true
LEFT JOIN public.vehicles v ON v.id = vb.vehicle_id
WHERE vb.status IN ('pending', 'confirmed');

-- Provide an RPC wrapper for pagination and normalized output
CREATE OR REPLACE FUNCTION public.get_active_fleet_tracking(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE(
  booking_id uuid,
  vehicle_id uuid,
  vehicle_name text,
  category text,
  customer_name text,
  latitude double precision,
  longitude double precision,
  status text,
  rental_started_at timestamptz,
  expected_return_at timestamptz,
  last_location_update timestamptz,
  elapsed_rental_interval interval
) LANGUAGE sql STABLE AS $$
  SELECT
    aft.booking_id,
    aft.vehicle_id,
    aft.vehicle_name,
    aft.category,
    aft.customer_name,
    aft.latitude,
    aft.longitude,
    aft.status,
    aft.rental_started_at,
    aft.expected_return_at,
    aft.last_location_update,
    (now() - aft.rental_started_at) as elapsed_rental_interval
  FROM public.active_fleet_tracking aft
  ORDER BY aft.last_location_update DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

-- Grant execute to anon/public role if needed (optional)
-- GRANT EXECUTE ON FUNCTION public.get_active_fleet_tracking(integer, integer) TO anon;
