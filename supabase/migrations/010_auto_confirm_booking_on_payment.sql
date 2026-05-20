-- ============================================================================
-- 010_auto_confirm_booking_on_payment.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- When a payment row transitions to 'completed', this trigger:
--   1. Aggregates all completed payments for that booking
--   2. Updates paid_amount, remaining_amount, payment_status on vehicle_bookings
--   3. Auto-confirms the booking when >= 60% of total_amount is paid
--   4. Marks payment_status as 'paid' when fully paid
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_booking_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking_id     uuid;
  v_total          numeric;
  v_paid           numeric;
  v_remaining      numeric;
  v_pay_status     text;
  v_booking_status text;
  v_current_status text;
BEGIN
  -- Only act when payment transitions to 'completed'
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'completed' THEN
    RETURN NEW;  -- already completed, no change
  END IF;

  v_booking_id := NEW.booking_id;
  IF v_booking_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get booking total and current status
  SELECT total_amount, status
    INTO v_total, v_current_status
    FROM public.vehicle_bookings
   WHERE id = v_booking_id;

  IF v_total IS NULL THEN
    RETURN NEW;  -- booking not found
  END IF;

  -- Sum all completed payments for this booking
  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM public.payments
   WHERE booking_id = v_booking_id
     AND status = 'completed';

  v_remaining := GREATEST(0, v_total - v_paid);

  -- Determine payment status
  IF v_paid >= v_total AND v_total > 0 THEN
    v_pay_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_pay_status := 'partial';
  ELSE
    v_pay_status := 'unpaid';
  END IF;

  -- Auto-confirm: if >= 60% paid and booking is still pending
  v_booking_status := v_current_status;
  IF v_current_status = 'pending' AND v_total > 0 AND v_paid >= (v_total * 0.6) THEN
    v_booking_status := 'confirmed';
  END IF;

  -- Update booking ledger
  UPDATE public.vehicle_bookings
  SET
    paid_amount     = v_paid,
    remaining_amount = v_remaining,
    payment_status  = v_pay_status,
    is_paid         = (v_pay_status = 'paid'),
    status          = v_booking_status,
    updated_at      = now()
  WHERE id = v_booking_id;

  -- Notify user if booking was auto-confirmed
  IF v_booking_status = 'confirmed' AND v_current_status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    SELECT
      vb.customer_user_id,
      'booking_confirmed',
      'Booking Confirmed',
      'Your booking ' || COALESCE(vb.booking_code, '') || ' has been confirmed after payment.',
      jsonb_build_object('bookingId', vb.id, 'bookingCode', COALESCE(vb.booking_code, ''))
    FROM public.vehicle_bookings vb
    WHERE vb.id = v_booking_id
      AND vb.customer_user_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to payments table
DROP TRIGGER IF EXISTS on_payment_completed_sync_booking ON public.payments;
CREATE TRIGGER on_payment_completed_sync_booking
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_booking_after_payment();

SELECT 'auto-confirm booking on payment trigger created' AS status;
