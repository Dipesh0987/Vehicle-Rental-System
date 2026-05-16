-- 030_migrate_khalti_to_esewa.sql
-- Purpose: Consolidate legacy Khalti-specific columns into generic provider_*
-- columns and map existing 'khalti' payment_method values to 'esewa'.
-- This is safe to run on production Postgres/Supabase as a migration.

BEGIN;

-- 1) Add generic provider columns if they don't exist yet
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_transaction_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_payment_url text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_response jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Backfill provider columns from legacy khalti_* columns where present
UPDATE public.payments
SET
  provider_reference = COALESCE(provider_reference, khalti_pidx),
  provider_transaction_id = COALESCE(provider_transaction_id, khalti_transaction_id),
  provider_payment_url = COALESCE(provider_payment_url, khalti_payment_url),
  provider_response = CASE
    WHEN provider_response IS NULL OR provider_response = '{}'::jsonb THEN COALESCE(khalti_response, '{}'::jsonb)
    ELSE provider_response
  END
WHERE khalti_pidx IS NOT NULL OR khalti_transaction_id IS NOT NULL OR khalti_payment_url IS NOT NULL OR (khalti_response IS NOT NULL AND khalti_response <> '{}'::jsonb);

-- 3) Map any legacy payment_method='khalti' to 'esewa' so runtime logic uses esewa
UPDATE public.payments
SET payment_method = 'esewa'
WHERE payment_method = 'khalti';

-- 4) Add an index to speed lookups by provider_reference
CREATE INDEX IF NOT EXISTS payments_provider_reference_idx ON public.payments (provider_reference) WHERE provider_reference IS NOT NULL;

COMMIT;

-- Notes:
-- - This migration preserves legacy khalti_* columns for auditability. If you
--   want to drop them later, add a follow-up migration after verifying no
--   runtime code relies on them.
-- - After deploy, update server code to use `provider_*` fields and remove
--   any remaining references to `khalti_*`.
