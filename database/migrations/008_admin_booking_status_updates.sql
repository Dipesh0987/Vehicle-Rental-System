-- 008_admin_booking_status_updates.sql
-- Purpose: Enable admin booking status updates through a controlled RPC endpoint.

create or replace function public.admin_update_booking_status(
  p_booking_id uuid,
  p_status text
)
returns public.vehicle_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
  updated_row public.vehicle_bookings;
begin
  normalized_status := lower(trim(coalesce(p_status, '')));

  if normalized_status not in ('pending', 'confirmed', 'cancelled', 'completed') then
    raise exception 'Invalid booking status: %', p_status;
  end if;

  update public.vehicle_bookings
  set status = normalized_status,
      updated_at = now()
  where id = p_booking_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Booking not found for id: %', p_booking_id;
  end if;

  return updated_row;
end;
$$;

grant execute on function public.admin_update_booking_status(uuid, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
