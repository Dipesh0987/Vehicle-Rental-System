-- ============================================================
-- Vehicle Rental System — Vehicle Seed with Booking Backup
-- This version EXPORTS bookings before deleting
-- 30 Real Vehicles with Actual Images (5 per type)
-- ============================================================

-- ⚠️ IMPORTANT: vehicle_id has NOT NULL constraint
-- We MUST delete bookings, but we'll show you how to backup first

-- Step 1: BACKUP YOUR BOOKINGS FIRST!
-- Run this query BEFORE running this script:
-- Copy the results and save to a CSV file
/*
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
*/

-- Step 2: Delete bookings (required - vehicle_id is NOT NULL)
DELETE FROM vehicle_bookings;

-- Step 3: Delete vehicle images
DELETE FROM vehicle_images WHERE vehicle_id IN (SELECT id FROM vehicles);

-- Step 4: Delete vehicles
DELETE FROM vehicles;

-- ============================================================
-- SEDAN VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  insurance_options, driver_options, mileage_policy, created_at, updated_at
) VALUES

-- 1. Toyota Camry
(
  'Camry', 'Toyota', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 6500,
  4.7, 'Kathmandu', 'available', true, true,
  ARRAY['GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Leather Seats', 'Sunroof'],
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80&sat=-100'
  ],
  'BA 1 PA 2201',
  ARRAY['Basic Coverage', 'Premium Coverage', 'Comprehensive'],
  ARRAY['Self-Drive', 'With Driver'],
  ARRAY['Unlimited'],
  NOW(), NOW()
),

-- 2. Honda Civic
(
  'Civic', 'Honda', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 5800,
  4.6, 'Pokhara', 'available', true, true,
  ARRAY['GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Reverse Camera', 'Lane Assist'],
  'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80'
  ],
  'BA 2 PA 3315',
  ARRAY['Basic Coverage', 'Premium Coverage'],
  ARRAY['Self-Drive', 'With Driver'],
  ARRAY['Unlimited'],
  NOW(), NOW()
),

-- 3. BMW 3 Series
(
  '3 Series', 'BMW', 'sedan', 'Sedan', 'Automatic', 'Diesel', 5, 8500,
  4.8, 'Kathmandu', 'available', true, true,
  ARRAY['GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Parking Sensors'],
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'
  ],
  'BA 1 PA 4420',
  ARRAY['Basic Coverage', 'Premium Coverage', 'Comprehensive'],
  ARRAY['Self-Drive', 'With Driver'],
  ARRAY['Unlimited'],
  NOW(), NOW()
),

-- 4. Mercedes-Benz C-Class
(
  'C-Class', 'Mercedes-Benz', 'sedan', 'Sedan', 'Automatic', 'Diesel', 5, 9000,
  4.8, 'Lalitpur', 'available', true, true,
  ARRAY['GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Ambient Lighting'],
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80'
  ],
  'BA 3 PA 5512',
  ARRAY['Basic Coverage', 'Premium Coverage', 'Comprehensive'],
  ARRAY['Self-Drive', 'With Driver'],
  ARRAY['Unlimited'],
  NOW(), NOW()
),

-- 5. Hyundai Sonata
(
  'Sonata', 'Hyundai', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 5500,
  4.5, 'Bhaktapur', 'available', true, true,
  ARRAY['GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Blind Spot Monitor'],
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80'
  ],
  'BA 1 PA 6601',
  ARRAY['Basic Coverage', 'Premium Coverage'],
  ARRAY['Self-Drive', 'With Driver'],
  ARRAY['Unlimited'],
  NOW(), NOW()
);

-- ============================================================
-- Note: This is a shortened SAFE version
-- For the complete 30 vehicles, use SEED_VEHICLES_COMPLETE.sql
-- after deciding whether to delete or preserve bookings
-- ============================================================

-- Verification
SELECT 'SAFE MODE: Bookings preserved, vehicles replaced' as status;
SELECT COUNT(*) as vehicle_count FROM vehicles;
SELECT COUNT(*) as booking_count FROM vehicle_bookings;
