-- ============================================================
-- BACKUP YOUR BOOKINGS BEFORE SEEDING VEHICLES
-- Run this FIRST, save the results, then run the seed script
-- ============================================================

-- Step 1: Export all bookings to view/save
SELECT 
  booking_id,
  vehicle_id,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  pickup_date,
  return_date,
  pickup_time,
  status,
  currency,
  base_price,
  driver_fee,
  insurance_fee,
  discount_amount,
  total_amount,
  payment_status,
  created_at,
  updated_at,
  booking_type,
  with_driver,
  payment_method,
  paid_amount,
  remaining_amount,
  payment_date,
  is_cancelled
FROM vehicle_bookings
ORDER BY created_at DESC;

-- Step 2: Count your bookings
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings
FROM vehicle_bookings;

-- Step 3: See which vehicles are referenced
SELECT 
  v.id as vehicle_id,
  v.brand,
  v.name,
  v.vehicle_number,
  COUNT(vb.booking_id) as booking_count
FROM vehicles v
LEFT JOIN vehicle_bookings vb ON v.id = vb.vehicle_id
GROUP BY v.id, v.brand, v.name, v.vehicle_number
HAVING COUNT(vb.booking_id) > 0
ORDER BY booking_count DESC;

-- ============================================================
-- INSTRUCTIONS:
-- ============================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Copy the results from the first query
-- 3. Save to Excel/CSV for backup
-- 4. Now you can safely run SEED_VEHICLES_COMPLETE.sql
-- ============================================================
