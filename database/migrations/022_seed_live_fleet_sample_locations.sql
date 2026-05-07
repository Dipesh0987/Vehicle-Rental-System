-- Migration: 022_seed_live_fleet_sample_locations.sql
-- Purpose: Seed sample telemetry records for active bookings to validate Live Fleet map behavior.

WITH active_bookings AS (
  SELECT
    vb.vehicle_id,
    ROW_NUMBER() OVER (ORDER BY vb.start_date DESC NULLS LAST, vb.id) AS rn
  FROM public.vehicle_bookings vb
  WHERE vb.status IN ('pending', 'confirmed')
  LIMIT 20
),
seed_points AS (
  SELECT
    vehicle_id,
    (27.7172 + (rn * 0.0032))::double precision AS latitude,
    (85.3240 + (rn * 0.0027))::double precision AS longitude,
    CASE
      WHEN rn % 3 = 0 THEN now() - interval '25 minutes' -- idle
      WHEN rn % 5 = 0 THEN now() - interval '2 minutes'  -- active
      ELSE now() - interval '8 minutes'                  -- active-ish
    END AS recorded_at,
    CASE
      WHEN rn % 2 = 0 THEN 'simulator'
      ELSE 'device'
    END AS source
  FROM active_bookings
)
INSERT INTO public.vehicle_locations (vehicle_id, latitude, longitude, recorded_at, source)
SELECT
  sp.vehicle_id,
  sp.latitude,
  sp.longitude,
  sp.recorded_at,
  sp.source
FROM seed_points sp;

-- Optional second pass to simulate movement updates for the same vehicles.
WITH active_bookings AS (
  SELECT
    vb.vehicle_id,
    ROW_NUMBER() OVER (ORDER BY vb.start_date DESC NULLS LAST, vb.id) AS rn
  FROM public.vehicle_bookings vb
  WHERE vb.status IN ('pending', 'confirmed')
  LIMIT 20
),
movement_points AS (
  SELECT
    vehicle_id,
    (27.7172 + (rn * 0.0032) + 0.0007)::double precision AS latitude,
    (85.3240 + (rn * 0.0027) + 0.0005)::double precision AS longitude,
    now() - interval '1 minute' AS recorded_at,
    'simulator-move'::text AS source
  FROM active_bookings
)
INSERT INTO public.vehicle_locations (vehicle_id, latitude, longitude, recorded_at, source)
SELECT
  mp.vehicle_id,
  mp.latitude,
  mp.longitude,
  mp.recorded_at,
  mp.source
FROM movement_points mp;
