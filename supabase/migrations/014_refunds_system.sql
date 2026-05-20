-- ============================================================================
-- 014_refunds_system.sql
-- Run in Supabase Dashboard → SQL Editor
-- Creates the refunds table, refund policy function, and RLS policies
-- for the complete refund workflow (admin-initiated, user-trackable).
-- ============================================================================

-- 1. Refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  refund_code     text NOT NULL UNIQUE,
  booking_id      uuid NOT NULL REFERENCES public.vehicle_bookings(id) ON DELETE CASCADE,
  payment_id      uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_code text,                          -- original payment transaction code
  customer_user_id uuid,
  customer_email   text,
  customer_name    text,

  -- Refund amounts
  original_paid_amount  numeric NOT NULL DEFAULT 0,
  refund_amount         numeric NOT NULL DEFAULT 0,
  refund_percentage     numeric NOT NULL DEFAULT 0,  -- 0, 50, or 100

  -- Policy
  policy_rule      text NOT NULL DEFAULT 'manual',   -- 'full_refund', 'partial_refund_50', 'no_refund', 'manual'
  pickup_date      timestamptz,
  cancelled_at     timestamptz,
  hours_before_pickup numeric DEFAULT 0,

  -- Refund method
  refund_method    text NOT NULL DEFAULT 'original',  -- 'original' (esewa), 'cash', 'bank_transfer'
  refund_reference text,                              -- external reference for cash/bank

  -- Status tracking (step-based)
  status           text NOT NULL DEFAULT 'initiated',
  -- Statuses: initiated → approved → processing → completed | failed | rejected
  status_history   jsonb DEFAULT '[]'::jsonb,

  -- Admin
  initiated_by     uuid,      -- admin user who initiated
  approved_by      uuid,      -- admin user who approved
  notes            text,      -- admin notes
  rejection_reason text,

  -- Email
  email_sent       boolean DEFAULT false,
  email_sent_at    timestamptz,

  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer_user_id ON public.refunds(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

-- 3. Sequence for refund codes (R-0001, R-0002, ...)
CREATE SEQUENCE IF NOT EXISTS public.refund_code_seq START 1;

-- 4. Function to generate refund code
CREATE OR REPLACE FUNCTION public.generate_refund_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.refund_code IS NULL OR NEW.refund_code = '' THEN
    NEW.refund_code := 'R-' || LPAD(nextval('public.refund_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_refund_code ON public.refunds;
CREATE TRIGGER trg_generate_refund_code
  BEFORE INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.generate_refund_code();

-- 5. Function to calculate refund eligibility based on policy
CREATE OR REPLACE FUNCTION public.calculate_refund_eligibility(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking    RECORD;
  v_paid       numeric;
  v_hours      numeric;
  v_rule       text;
  v_percentage numeric;
  v_refund_amt numeric;
BEGIN
  SELECT * INTO v_booking
  FROM public.vehicle_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Booking not found');
  END IF;

  IF v_booking.status != 'cancelled' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Booking is not cancelled');
  END IF;

  v_paid := COALESCE(v_booking.paid_amount, 0);
  IF v_paid <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'No payment was made for this booking');
  END IF;

  -- Check if refund already exists
  IF EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id AND status NOT IN ('rejected', 'failed')) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'A refund is already in progress for this booking');
  END IF;

  -- Calculate hours before pickup
  v_hours := EXTRACT(EPOCH FROM (v_booking.start_date::timestamptz - COALESCE(v_booking.updated_at, now()))) / 3600;

  -- Apply refund policy
  IF v_hours > 24 THEN
    v_rule := 'full_refund';
    v_percentage := 100;
  ELSIF v_hours >= 2 THEN
    v_rule := 'partial_refund_50';
    v_percentage := 50;
  ELSE
    v_rule := 'no_refund';
    v_percentage := 0;
  END IF;

  v_refund_amt := ROUND(v_paid * (v_percentage / 100.0), 2);

  RETURN jsonb_build_object(
    'eligible', v_percentage > 0,
    'rule', v_rule,
    'percentage', v_percentage,
    'original_paid', v_paid,
    'refund_amount', v_refund_amt,
    'hours_before_pickup', ROUND(v_hours, 1),
    'pickup_date', v_booking.start_date,
    'cancelled_at', v_booking.updated_at,
    'booking_code', v_booking.booking_code,
    'customer_name', v_booking.customer_name,
    'customer_email', v_booking.customer_email,
    'customer_user_id', v_booking.customer_user_id,
    'reason', CASE
      WHEN v_percentage = 100 THEN 'Full refund: cancelled more than 24 hours before pickup'
      WHEN v_percentage = 50 THEN 'Partial refund (50%): cancelled 2-24 hours before pickup'
      ELSE 'No refund: cancelled less than 2 hours before pickup'
    END
  );
END;
$$;

-- 6. Function to update booking ledger after refund completion
CREATE OR REPLACE FUNCTION public.apply_refund_to_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.vehicle_bookings
    SET
      paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - NEW.refund_amount),
      remaining_amount = COALESCE(remaining_amount, 0) + NEW.refund_amount,
      payment_status = CASE
        WHEN COALESCE(paid_amount, 0) - NEW.refund_amount <= 0 THEN 'refunded'
        ELSE 'partial_refund'
      END,
      updated_at = now()
    WHERE id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_refund ON public.refunds;
CREATE TRIGGER trg_apply_refund
  AFTER UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.apply_refund_to_booking();

-- 7. RLS policies
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Admins: full access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refunds' AND policyname = 'Admins manage all refunds') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage all refunds"
        ON public.refunds FOR ALL
        USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    $policy$;
  END IF;
END $$;

-- Customers: read own refunds
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refunds' AND policyname = 'Customers read own refunds') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers read own refunds"
        ON public.refunds FOR SELECT
        USING (
          customer_user_id = auth.uid()
          OR customer_email = (auth.jwt() ->> 'email')
        )
    $policy$;
  END IF;
END $$;

-- 8. Grant execute
GRANT EXECUTE ON FUNCTION public.calculate_refund_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_refund_eligibility(uuid) TO service_role;

SELECT 'Refunds system installed successfully' AS status;
