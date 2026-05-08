-- ai_chat_setup_and_validation.sql
-- Purpose: quick SQL checks to validate booking AI data sources in Supabase.
-- Run in Supabase SQL Editor after deploying the booking-chat edge function.

-- 1) Confirm table exists and has records.
select count(*) as total_bookings
from public.vehicle_bookings;

-- 2) Inspect booking fields used by AI responses.
select
  id,
  booking_code,
  customer_user_id,
  customer_email,
  start_date,
  end_date,
  pickup_time,
  status,
  payment_status,
  is_paid,
  total_amount,
  created_at
from public.vehicle_bookings
order by created_at desc
limit 25;

-- 3) Verify linked vehicles used for vehicle details answers.
select
  id,
  brand,
  name,
  category,
  status,
  is_active
from public.vehicles
order by created_at desc nulls last
limit 25;

-- 4) Show latest bookings joined with vehicle label preview.
select
  b.id,
  b.booking_code,
  b.customer_user_id,
  b.customer_email,
  b.start_date,
  b.end_date,
  b.status,
  b.payment_status,
  b.is_paid,
  b.total_amount,
  b.currency,
  concat_ws(' ', v.brand, v.name) as vehicle_label,
  v.category as vehicle_category,
  b.created_at
from public.vehicle_bookings b
left join public.vehicles v on v.id = b.vehicle_id
order by b.created_at desc
limit 30;

-- 5) Count by status for sanity check.
select
  coalesce(status, 'unknown') as status,
  count(*) as total
from public.vehicle_bookings
group by coalesce(status, 'unknown')
order by total desc;

-- 6) Upcoming bookings snapshot (used for date-relative answers).
select
  booking_code,
  start_date,
  end_date,
  status,
  total_amount,
  currency
from public.vehicle_bookings
where start_date >= current_date
order by start_date asc
limit 30;

-- 7) Cancelled and paid states (for refund/invoice response paths).
select
  booking_code,
  status,
  payment_status,
  is_paid,
  total_amount,
  currency,
  created_at
from public.vehicle_bookings
where lower(coalesce(status, '')) in ('cancelled', 'completed', 'confirmed', 'pending')
order by created_at desc
limit 40;
