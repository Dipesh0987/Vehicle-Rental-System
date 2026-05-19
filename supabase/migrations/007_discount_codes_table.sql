-- ============================================================================
-- 007_discount_codes_table.sql
-- Run in Supabase Dashboard → SQL Editor
-- Creates discount_codes table used by the admin Pricing & Promos module
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  description         text NOT NULL DEFAULT '',
  discount_type       text NOT NULL DEFAULT 'percentage',
  discount_value      numeric(10,2) NOT NULL DEFAULT 0,
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  max_uses            integer,
  current_uses        integer NOT NULL DEFAULT 0,
  min_booking_amount  numeric(10,2),
  max_discount_amount numeric(10,2),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "Admin manages discount codes" ON public.discount_codes;
CREATE POLICY "Admin manages discount codes" ON public.discount_codes
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR public.is_admin_user()
  );

-- Authenticated users can read active codes (for coupon validation at checkout)
DROP POLICY IF EXISTS "Users read active discount codes" ON public.discount_codes;
CREATE POLICY "Users read active discount codes" ON public.discount_codes
  FOR SELECT USING (
    is_active = true
    AND valid_from <= now()
    AND valid_until >= now()
  );

SELECT 'discount_codes table created' AS status;
