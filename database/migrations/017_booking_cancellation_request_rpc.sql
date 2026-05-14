-- 017_booking_cancellation_request_rpc.sql
-- Purpose: Provide a safe user cancellation-request write path under RLS.
--
-- Run this migration in Supabase SQL editor or your migration pipeline.

create or replace function public.request_booking_cancellation(
  p_booking_id uuid,
  p_reason text
)
returns public.vehicle_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.vehicle_bookings%rowtype;
  v_reason text;
  v_pickup_location text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Cancellation reason is required.' using errcode = '22023';
  end if;

  select *
  into v_booking
  from public.vehicle_bookings
  where id = p_booking_id
    and customer_user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Booking not found or access denied.' using errcode = '42501';
  end if;

  select nullif(trim(substring(coalesce(v_booking.notes, '') from '(?im)^Pickup Location:\s*(.+)$')), '')
  into v_pickup_location;

  update public.vehicle_bookings
  set
    notes = case
      when v_pickup_location is not null
        then 'Pickup Location: ' || v_pickup_location || E'\nUser Message: Cancel request: ' || v_reason
      else 'User Message: Cancel request: ' || v_reason
    end,
    status = case
      when status = 'confirmed' then 'pending'
      else status
    end
  where id = v_booking.id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking_cancellation(uuid, text) from public;
grant execute on function public.request_booking_cancellation(uuid, text) to authenticated;

notify pgrst, 'reload schema';
