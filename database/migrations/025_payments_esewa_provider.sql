-- 025_payments_esewa_provider.sql
-- Purpose: Make the payments table provider-agnostic so it can carry eSewa
-- (and any future gateway) data without forcing a column rename.
--
-- Migration 023 originally created khalti_pidx / khalti_transaction_id /
-- khalti_payment_url / khalti_response. eSewa uses a different vocabulary:
--   * pidx                  -> transaction_uuid (we generate this client-side)
--   * transaction_id        -> ref_id (returned by eSewa on success)
--   * payment_url           -> gateway form URL (same for all txns, not per-row)
--   * khalti_response       -> verify-status JSON
--
-- Strategy: add neutral columns next to the legacy ones, backfill from the
-- legacy columns when present, and let new code use the neutral names. The
-- old columns stay so the existing Khalti edge function keeps compiling for
-- anyone running both providers in parallel.

------------------------------------------------------------------------------
-- 1. Neutral provider columns
------------------------------------------------------------------------------

alter table public.payments
  add column if not exists provider_reference text;

alter table public.payments
  add column if not exists provider_transaction_id text;

alter table public.payments
  add column if not exists provider_response jsonb not null default '{}'::jsonb;

------------------------------------------------------------------------------
-- 2. Backfill from legacy Khalti columns so existing rows stay queryable
------------------------------------------------------------------------------

update public.payments
   set provider_reference = khalti_pidx
 where provider_reference is null
   and khalti_pidx is not null;

update public.payments
   set provider_transaction_id = khalti_transaction_id
 where provider_transaction_id is null
   and khalti_transaction_id is not null;

update public.payments
   set provider_response = khalti_response
 where (provider_response is null or provider_response = '{}'::jsonb)
   and khalti_response is not null
   and khalti_response <> '{}'::jsonb;

------------------------------------------------------------------------------
-- 3. Indexes for the lookups the eSewa edge function does
------------------------------------------------------------------------------

create index if not exists idx_payments_provider_reference
  on public.payments (provider_reference)
  where provider_reference is not null;

create index if not exists idx_payments_provider_transaction_id
  on public.payments (provider_transaction_id)
  where provider_transaction_id is not null;

------------------------------------------------------------------------------
-- 4. PostgREST schema cache reload
------------------------------------------------------------------------------

notify pgrst, 'reload schema';
