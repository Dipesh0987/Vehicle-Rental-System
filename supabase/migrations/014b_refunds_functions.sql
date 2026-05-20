-- Part 2: Refund eligibility function + booking ledger trigger

CREATE OR REPLACE FUNCTION public.calculate_refund_eligibility(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking    RECORD;
  v_paid       numeric;
  v_hours      numeric;
  v_rule       text;
  v_percentage numeric;
  v_refund_amt numeric;
BEGIN
  SELECT * INTO v_booking FROM public.vehicle_bookings WHERE id = p_booking_id;
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
  IF EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id AND status NOT IN ('rejected', 'failed')) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'A refund is already in progress for this booking');
  END IF;
  v_hours := EXTRACT(EPOCH FROM (v_booking.start_date::timestamptz - COALESCE(v_booking.updated_at, now()))) / 3600;
  IF v_hours > 24 THEN
    v_rule := 'full_refund'; v_percentage := 100;
  ELSIF v_hours >= 2 THEN
    v_rule := 'partial_refund_50'; v_percentage := 50;
  ELSE
    v_rule := 'no_refund'; v_percentage := 0;
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

CREATE OR REPLACE FUNCTION public.apply_refund_to_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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

GRANT EXECUTE ON FUNCTION public.calculate_refund_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_refund_eligibility(uuid) TO service_role;
