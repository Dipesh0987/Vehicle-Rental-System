-- Part 3: RLS policies for refunds table

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all refunds"
  ON public.refunds FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Customers read own refunds"
  ON public.refunds FOR SELECT
  USING (
    customer_user_id = auth.uid()
    OR customer_email = (auth.jwt() ->> 'email')
  );
