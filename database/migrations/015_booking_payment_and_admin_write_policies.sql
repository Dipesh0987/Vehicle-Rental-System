-- 015_booking_payment_and_admin_write_policies.sql
-- Purpose: Add payment tracking to bookings and allow admin users to edit/delete bookings under RLS.

-- Payment tracking fields used by admin booking quick-toggle/edit flows.
alter table public.vehicle_bookings
  add column if not exists is_paid boolean not null default false;

alter table public.vehicle_bookings
  add column if not exists payment_status text not null default 'unpaid';

-- Keep payment_status constrained to known values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_bookings_payment_status_check'
      and conrelid = 'public.vehicle_bookings'::regclass
  ) then
    alter table public.vehicle_bookings
      add constraint vehicle_bookings_payment_status_check
      check (payment_status in ('paid', 'unpaid'));
  end if;
end;
$$;

-- Normalize any pre-existing records.
update public.vehicle_bookings
set is_paid = coalesce(is_paid, false);

update public.vehicle_bookings
set payment_status = case when is_paid then 'paid' else 'unpaid' end
where payment_status is null
   or nullif(trim(payment_status), '') is null
   or lower(trim(payment_status)) not in ('paid', 'unpaid');

-- Helpful for admin filters in dashboard.
create index if not exists idx_vehicle_bookings_paid_created_at
  on public.vehicle_bookings (is_paid, created_at desc);

-- RLS: allow authenticated admins to edit and delete bookings.
-- Uses existing helper function public.is_admin_user(auth.uid()).
drop policy if exists "Admins can update vehicle bookings" on public.vehicle_bookings;
create policy "Admins can update vehicle bookings"
on public.vehicle_bookings
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete vehicle bookings" on public.vehicle_bookings;
create policy "Admins can delete vehicle bookings"
on public.vehicle_bookings
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

notify pgrst, 'reload schema';
