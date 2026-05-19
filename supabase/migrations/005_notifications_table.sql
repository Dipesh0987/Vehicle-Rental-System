-- ============================================================================
-- 005_notifications_table.sql
-- Run in Supabase Dashboard → SQL Editor
-- Creates the notifications table + RLS + RPC for mark-read
-- ============================================================================

-- ── 1. notifications table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'info',
  title      text NOT NULL DEFAULT '',
  body       text DEFAULT '',
  link_url   text DEFAULT '',
  metadata   jsonb DEFAULT '{}'::jsonb,
  is_admin   boolean DEFAULT false,
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (for marking read)
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin can read all notifications
DROP POLICY IF EXISTS "Admin reads all notifications" ON public.notifications;
CREATE POLICY "Admin reads all notifications" ON public.notifications
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR public.is_admin_user()
  );

-- Service role / triggers can insert notifications for any user
DROP POLICY IF EXISTS "Service inserts notifications" ON public.notifications;
CREATE POLICY "Service inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;


-- ── 2. mark_notifications_read RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = ANY(p_ids)
    AND user_id = auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ── 3. mark_all_notifications_read RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


-- ── 4. Auto-notify on booking creation ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.customer_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.customer_user_id,
      'booking_created',
      'Booking Created',
      'Your booking ' || COALESCE(NEW.booking_code, '') || ' has been created. Please complete payment within 15 minutes.',
      jsonb_build_object('bookingId', NEW.id, 'bookingCode', COALESCE(NEW.booking_code, ''))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_created_notify ON public.vehicle_bookings;
CREATE TRIGGER on_booking_created_notify
  AFTER INSERT ON public.vehicle_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_created();


-- ── 5. Auto-notify on payment status change ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.customer_user_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed' OR NEW.status = 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        NEW.customer_user_id,
        'payment_success',
        'Payment Successful',
        'Your payment of ' || COALESCE(NEW.currency, 'NPR') || ' ' || COALESCE(NEW.amount::text, '0') || ' was successful.',
        jsonb_build_object('bookingId', NEW.booking_id, 'transactionCode', COALESCE(NEW.transaction_code, ''))
      );
    ELSIF NEW.status = 'failed' THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        NEW.customer_user_id,
        'payment_failed',
        'Payment Failed',
        'Your payment could not be processed. ' || COALESCE(NEW.failure_reason, 'Please try again.'),
        jsonb_build_object('bookingId', NEW.booking_id, 'transactionCode', COALESCE(NEW.transaction_code, ''))
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_status_notify ON public.payments;
CREATE TRIGGER on_payment_status_notify
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_status();


-- ── 6. Enable realtime for notifications ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'notifications table + triggers created' AS status;
