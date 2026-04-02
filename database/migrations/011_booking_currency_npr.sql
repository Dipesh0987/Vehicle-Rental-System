-- 011_booking_currency_npr.sql
-- Purpose: Standardize booking currency to NPR for all vehicle booking records.

alter table public.vehicle_bookings
  alter column currency set default 'NPR';

update public.vehicle_bookings
set currency = 'NPR'
where currency is null
   or nullif(trim(currency), '') is null
   or upper(trim(currency)) <> 'NPR';

notify pgrst, 'reload schema';
