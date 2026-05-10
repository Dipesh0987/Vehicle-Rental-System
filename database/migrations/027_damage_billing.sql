-- 027_damage_billing.sql
-- Purpose: Add damage billing infrastructure.
--   1. Extend maintenance_records.status with 'Billed'
--   2. Create damage_bills table  (INV-XXXX codes, P-XXXX transaction codes)
--   3. Auto-update trigger for updated_at
--   4. bill_code generator  (INV-XXXX)
--   5. Escalation function  (72-hour unpaid → Overdue + admin notification)
-- Run in Supabase SQL editor after 026_reset_vehicles_seed.sql.

-- ── 0. Widen notifications.type constraint ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_type_check'
       AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END;
$$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'payment_initiated', 'payment_success', 'payment_failed',
    'payment_expired', 'receipt_sent', 'booking_confirmed',
    'booking_status_changed', 'payment_due', 'admin_payment_alert',
    'booking_created', 'verification_approved', 'verification_rejected',
    'general',
    'damage_bill_issued', 'damage_bill_overdue', 'damage_bill_paid'
  ));

-- ── 1. Extend status check on maintenance_records ────────────────────────
ALTER TABLE public.maintenance_records
  DROP CONSTRAINT IF EXISTS maintenance_records_status_check;

ALTER TABLE public.maintenance_records
  ADD CONSTRAINT maintenance_records_status_check
  CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Billed'));

-- ── 2. damage_bills table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.damage_bills (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-readable identifiers
  bill_code             text          UNIQUE NOT NULL,          -- INV-XXXX
  transaction_code      text          UNIQUE,                   -- P-XXXX (set on payment)

  -- Links
  maintenance_record_id uuid          REFERENCES public.maintenance_records(id)
                                        ON DELETE SET NULL,
  maintenance_ref       text          NOT NULL,                 -- M-XXX copy for display
  booking_ref           text,                                   -- booking_code if known

  -- Customer info (captured at billing time, not FK-linked)
  customer_name         text          NOT NULL,
  customer_email        text          NOT NULL
                                        CHECK (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Charge details
  amount                numeric(10,2) NOT NULL CHECK (amount > 0),
  reason                text          NOT NULL,
  notes                 text,

  -- Payment
  status                text          NOT NULL DEFAULT 'Pending'
                                        CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
  esewa_uuid            text,                                   -- transaction_uuid sent to eSewa
  esewa_ref_id          text,                                   -- eSewa ref_id from status API
  payment_url           text,                                   -- customer-facing payment page URL

  -- Timestamps
  billed_at             timestamptz   NOT NULL DEFAULT now(),
  due_at                timestamptz   NOT NULL DEFAULT (now() + interval '72 hours'),
  paid_at               timestamptz,
  escalated_at          timestamptz,

  created_by            uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_damage_bills_status
  ON public.damage_bills(status);

CREATE INDEX IF NOT EXISTS idx_damage_bills_due_at
  ON public.damage_bills(due_at)
  WHERE status = 'Pending';

CREATE INDEX IF NOT EXISTS idx_damage_bills_maint_ref
  ON public.damage_bills(maintenance_ref);

CREATE INDEX IF NOT EXISTS idx_damage_bills_maint_record_id
  ON public.damage_bills(maintenance_record_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.damage_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage damage bills" ON public.damage_bills;
CREATE POLICY "Authenticated users can manage damage bills"
  ON public.damage_bills
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 5. updated_at trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_damage_bills_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS damage_bills_updated_at_trigger ON public.damage_bills;
CREATE TRIGGER damage_bills_updated_at_trigger
  BEFORE UPDATE ON public.damage_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_damage_bills_updated_at();

-- ── 6. bill_code generator: INV-XXXX (4-digit numeric suffix) ────────────
CREATE OR REPLACE FUNCTION public.next_bill_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTR(bill_code, 5) AS integer)),
    1000
  ) + 1
    INTO next_num
    FROM public.damage_bills
   WHERE bill_code ~ '^INV-[0-9]+$';

  RETURN 'INV-' || LPAD(next_num::text, 4, '0');
END;
$$;

-- ── 7. transaction_code generator: P-XXXX (mirrors payments table prefix) ─
CREATE OR REPLACE FUNCTION public.next_damage_transaction_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTR(transaction_code, 3) AS integer)),
    5000
  ) + 1
    INTO next_num
    FROM public.damage_bills
   WHERE transaction_code ~ '^P-[0-9]+$';

  RETURN 'P-' || LPAD(next_num::text, 4, '0');
END;
$$;

-- ── 8. Escalation: Pending bills past due_at → Overdue + admin alert ──────
CREATE OR REPLACE FUNCTION public.escalate_overdue_damage_bills()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer := 0;
  bill  record;
BEGIN
  FOR bill IN
    SELECT id, bill_code, maintenance_ref, customer_name,
           customer_email, amount, due_at
      FROM public.damage_bills
     WHERE status       = 'Pending'
       AND due_at       < now()
       AND escalated_at IS NULL
  LOOP
    UPDATE public.damage_bills
       SET status       = 'Overdue',
           escalated_at = now(),
           updated_at   = now()
     WHERE id = bill.id;

    INSERT INTO public.notifications (
      user_id, is_admin, type, title, body, metadata
    ) VALUES (
      NULL,
      true,
      'damage_bill_overdue',
      'Damage bill overdue — ' || bill.bill_code,
      'Customer ' || bill.customer_name
        || ' has not paid ' || bill.bill_code
        || ' (NPR ' || TRIM(TO_CHAR(bill.amount, 'FM999G999G990D00'))
        || ') for claim ' || bill.maintenance_ref
        || '. Was due '
        || TO_CHAR(
             bill.due_at AT TIME ZONE 'Asia/Kathmandu',
             'DD Mon YYYY HH24:MI'
           ) || ' (NPT).',
      jsonb_build_object(
        'billCode',       bill.bill_code,
        'maintenanceRef', bill.maintenance_ref,
        'customerName',   bill.customer_name,
        'customerEmail',  bill.customer_email,
        'amount',         bill.amount,
        'dueAt',          bill.due_at
      )
    );

    total := total + 1;
  END LOOP;

  RETURN total;
END;
$$;

NOTIFY pgrst, 'reload schema';
