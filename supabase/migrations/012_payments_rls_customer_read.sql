-- ============================================================================
-- 012_payments_rls_customer_read.sql
-- Run in Supabase Dashboard → SQL Editor
-- Ensures customers can read their own payment rows via RLS.
-- ============================================================================

-- Enable RLS on payments if not already enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow customers to read payments matching their email or user id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments' AND policyname = 'Customers read own payments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers read own payments"
        ON public.payments
        FOR SELECT
        USING (
          customer_user_id = auth.uid()
          OR customer_email = (auth.jwt() ->> 'email')
        )
    $policy$;
  END IF;
END $$;

-- Allow admins to read all payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments' AND policyname = 'Admins read all payments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins read all payments"
        ON public.payments
        FOR SELECT
        USING (
          (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        )
    $policy$;
  END IF;
END $$;

-- Allow admins full access to payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments' AND policyname = 'Admins manage all payments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage all payments"
        ON public.payments
        FOR ALL
        USING (
          (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        )
    $policy$;
  END IF;
END $$;

SELECT 'payments RLS policies created' AS status;
