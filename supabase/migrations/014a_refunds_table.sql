-- Part 1: Create refunds table + indexes + sequence + code trigger

CREATE TABLE IF NOT EXISTS public.refunds (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  refund_code     text NOT NULL UNIQUE,
  booking_id      uuid NOT NULL REFERENCES public.vehicle_bookings(id) ON DELETE CASCADE,
  payment_id      uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_code text,
  customer_user_id uuid,
  customer_email   text,
  customer_name    text,
  original_paid_amount  numeric NOT NULL DEFAULT 0,
  refund_amount         numeric NOT NULL DEFAULT 0,
  refund_percentage     numeric NOT NULL DEFAULT 0,
  policy_rule      text NOT NULL DEFAULT 'manual',
  pickup_date      timestamptz,
  cancelled_at     timestamptz,
  hours_before_pickup numeric DEFAULT 0,
  refund_method    text NOT NULL DEFAULT 'original',
  refund_reference text,
  status           text NOT NULL DEFAULT 'initiated',
  status_history   jsonb DEFAULT '[]'::jsonb,
  initiated_by     uuid,
  approved_by      uuid,
  notes            text,
  rejection_reason text,
  email_sent       boolean DEFAULT false,
  email_sent_at    timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer_user_id ON public.refunds(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

CREATE SEQUENCE IF NOT EXISTS public.refund_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_refund_code()
RETURNS trigger LANGUAGE plpgsql AS $$
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
