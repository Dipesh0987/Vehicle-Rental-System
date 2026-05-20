-- ─────────────────────────────────────────────────────────────────────
-- 012_vehicle_images_url_text.sql
-- Ensures vehicle_images.url column is TEXT (unlimited length) so
-- that both regular URLs and base64 data-URLs can be stored.
-- Also adds sort_order and is_primary if missing.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Ensure the table exists (create if missing)
  CREATE TABLE IF NOT EXISTS public.vehicle_images (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    url         text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    is_primary  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  -- Widen url column to TEXT if it currently has a character limit
  -- (e.g. varchar(255) would silently truncate or reject base64 data-URLs)
  ALTER TABLE public.vehicle_images
    ALTER COLUMN url TYPE text;

  -- Add sort_order if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicle_images'
      AND column_name  = 'sort_order'
  ) THEN
    ALTER TABLE public.vehicle_images ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;

  -- Add is_primary if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicle_images'
      AND column_name  = 'is_primary'
  ) THEN
    ALTER TABLE public.vehicle_images ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
  END IF;

  RAISE NOTICE 'vehicle_images schema verified/updated';
END $$;

-- Index for fast lookups by vehicle_id
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id
  ON public.vehicle_images (vehicle_id, sort_order);

-- Allow authenticated (admin) writes and public reads
DO $$
BEGIN
  -- Enable RLS if not already on
  ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

  -- Public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vehicle_images' AND policyname = 'vehicle_images_public_read'
  ) THEN
    CREATE POLICY vehicle_images_public_read ON public.vehicle_images
      FOR SELECT USING (true);
  END IF;

  -- Authenticated write (admin users)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vehicle_images' AND policyname = 'vehicle_images_auth_write'
  ) THEN
    CREATE POLICY vehicle_images_auth_write ON public.vehicle_images
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS policy setup skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
