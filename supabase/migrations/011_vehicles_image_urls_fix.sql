-- ─────────────────────────────────────────────────────────────────────
-- 011_vehicles_image_urls_fix.sql
-- Ensures image_urls column exists on vehicles table as jsonb[]
-- and is large enough to hold base64 data-URL arrays.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  col_type text;
BEGIN
  -- Check current column type
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'vehicles'
    AND column_name  = 'image_urls';

  IF col_type IS NULL THEN
    -- Column is missing entirely – add it
    ALTER TABLE public.vehicles
      ADD COLUMN image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
    RAISE NOTICE 'image_urls column added as jsonb';

  ELSIF col_type = 'jsonb' THEN
    RAISE NOTICE 'image_urls is already jsonb – nothing to change';

  ELSIF col_type = 'ARRAY' THEN
    -- text[] / varchar[] – convert to jsonb
    ALTER TABLE public.vehicles
      ALTER COLUMN image_urls TYPE jsonb
      USING to_jsonb(image_urls);
    RAISE NOTICE 'image_urls converted from ARRAY to jsonb';

  ELSE
    -- text / varchar – wrap existing value in a jsonb array
    ALTER TABLE public.vehicles
      ALTER COLUMN image_urls TYPE jsonb
      USING CASE
        WHEN image_urls IS NULL OR image_urls = '' THEN '[]'::jsonb
        WHEN image_urls LIKE '[%'                  THEN image_urls::jsonb
        ELSE jsonb_build_array(image_urls)
      END;
    RAISE NOTICE 'image_urls converted from % to jsonb', col_type;
  END IF;
END $$;

-- Make sure the column has a sane default
ALTER TABLE public.vehicles
  ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb;

-- Reload PostgREST schema cache so the new type is visible immediately
NOTIFY pgrst, 'reload schema';
