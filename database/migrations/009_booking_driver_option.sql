-- 009_booking_driver_option.sql
-- Purpose: Add driver option to booking records and enforce valid values.

alter table public.vehicle_bookings
  add column if not exists driver_option text;

update public.vehicle_bookings
set driver_option = 'self_drive'
where driver_option is null
  or trim(driver_option) = '';

alter table public.vehicle_bookings
  alter column driver_option set default 'self_drive';

alter table public.vehicle_bookings
  alter column driver_option set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_bookings_driver_option_check'
      and conrelid = 'public.vehicle_bookings'::regclass
  ) then
    alter table public.vehicle_bookings
      add constraint vehicle_bookings_driver_option_check
      check (driver_option in ('self_drive', 'with_driver'));
  end if;
end;
$$;

notify pgrst, 'reload schema';
