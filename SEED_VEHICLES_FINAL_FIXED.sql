-- ============================================================
-- Vehicle Rental System — FINAL Seed Script
-- Matches YOUR exact table structure
-- 30 Real Vehicles with Actual Images (5 per type)
-- ============================================================

-- Step 1: Delete old data
DELETE FROM vehicle_bookings;
DELETE FROM vehicle_images WHERE vehicle_id IN (SELECT id FROM vehicles);
DELETE FROM vehicles;

-- ============================================================
-- SEDAN VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 1. Toyota Camry
(
  'Camry', 'Toyota', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 6500,
  4.7, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Leather Seats', 'Sunroof'],
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 2201',
  NOW(), NOW()
),

-- 2. Honda Civic
(
  'Civic', 'Honda', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 5800,
  4.6, 'Pokhara', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Reverse Camera', 'Lane Assist'],
  'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=80'],
  'BA 2 PA 3315',
  NOW(), NOW()
),

-- 3. BMW 3 Series
(
  '3 Series', 'BMW', 'sedan', 'Sedan', 'Automatic', 'Diesel', 5, 8500,
  4.8, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Parking Sensors'],
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 4420',
  NOW(), NOW()
),

-- 4. Mercedes-Benz C-Class
(
  'C-Class', 'Mercedes-Benz', 'sedan', 'Sedan', 'Automatic', 'Diesel', 5, 9000,
  4.8, 'Lalitpur', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Ambient Lighting'],
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80'],
  'BA 3 PA 5512',
  NOW(), NOW()
),

-- 5. Hyundai Sonata
(
  'Sonata', 'Hyundai', 'sedan', 'Sedan', 'Automatic', 'Petrol', 5, 5500,
  4.5, 'Bhaktapur', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Blind Spot Monitor'],
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 6601',
  NOW(), NOW()
);


-- ============================================================
-- SUV VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 6. Toyota Fortuner
(
  'Fortuner', 'Toyota', 'suv', 'SUV', 'Automatic', 'Diesel', 7, 12000,
  4.8, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Child Seat', '4WD', 'Hill Assist'],
  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 7710',
  NOW(), NOW()
),

-- 7. Hyundai Tucson
(
  'Tucson', 'Hyundai', 'suv', 'SUV', 'Automatic', 'Diesel', 5, 9500,
  4.6, 'Pokhara', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Parking Sensors', 'Lane Keep Assist'],
  'https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=1200&q=80'],
  'GA 1 PA 8823',
  NOW(), NOW()
),

-- 8. Kia Sportage
(
  'Sportage', 'Kia', 'suv', 'SUV', 'Automatic', 'Petrol', 5, 8800,
  4.5, 'Chitwan', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Blind Spot Monitor', 'Heated Seats'],
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80'],
  'NA 3 PA 1102',
  NOW(), NOW()
),

-- 9. BMW X5
(
  'X5', 'BMW', 'suv', 'SUV', 'Automatic', 'Diesel', 5, 15000,
  4.9, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Panoramic Roof', '360 Camera', 'Massage Seats'],
  'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 9934',
  NOW(), NOW()
),

-- 10. Land Rover Range Rover Sport
(
  'Range Rover Sport', 'Land Rover', 'suv', 'SUV', 'Automatic', 'Diesel', 5, 18000,
  4.9, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Child Seat', 'Terrain Response', 'Air Suspension', 'Meridian Sound'],
  'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 1045',
  NOW(), NOW()
);

-- ============================================================
-- HATCHBACK VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 11. Suzuki Swift
(
  'Swift', 'Suzuki', 'hatchback', 'Hatchback', 'Manual', 'Petrol', 5, 3500,
  4.4, 'Kathmandu', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Reverse Camera', 'Power Windows', 'Central Locking'],
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0afe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0afe?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1549317661-bd32c8ce0afe?auto=format&fit=crop&w=1200&q=80'],
  'BA 2 PA 2211',
  NOW(), NOW()
),

-- 12. Hyundai i20
(
  'i20', 'Hyundai', 'hatchback', 'Hatchback', 'Automatic', 'Petrol', 5, 4200,
  4.5, 'Lalitpur', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Cruise Control', 'Touchscreen'],
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 3322',
  NOW(), NOW()
),

-- 13. Volkswagen Polo
(
  'Polo', 'Volkswagen', 'hatchback', 'Hatchback', 'Manual', 'Petrol', 5, 4000,
  4.4, 'Bhaktapur', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Cruise Control', 'Reverse Camera', 'Touchscreen', 'Power Windows'],
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1200&q=80'],
  'BA 3 PA 4433',
  NOW(), NOW()
),

-- 14. Honda Jazz
(
  'Jazz', 'Honda', 'hatchback', 'Hatchback', 'Automatic', 'Petrol', 5, 4500,
  4.5, 'Pokhara', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Apple CarPlay', 'Reverse Camera', 'Magic Seats', 'Touchscreen'],
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80'],
  'GA 2 PA 5544',
  NOW(), NOW()
),

-- 15. Suzuki Baleno
(
  'Baleno', 'Suzuki', 'hatchback', 'Hatchback', 'Automatic', 'Petrol', 5, 3800,
  4.3, 'Chitwan', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Touchscreen', 'Keyless Entry'],
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80'],
  'NA 1 PA 6655',
  NOW(), NOW()
);


-- ============================================================
-- LUXURY VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 16. Mercedes-Benz S-Class
(
  'S-Class', 'Mercedes-Benz', 'luxury', 'Luxury', 'Automatic', 'Petrol', 5, 28000,
  5.0, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Child Seat', 'Massage Seats', 'Burmester Sound', 'Ambient Lighting', 'Air Suspension'],
  'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 7766',
  NOW(), NOW()
),

-- 17. BMW 7 Series
(
  '7 Series', 'BMW', 'luxury', 'Luxury', 'Automatic', 'Diesel', 5, 30000,
  5.0, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Gesture Control', 'Harman Kardon Sound', 'Night Vision', 'Executive Lounge Seats'],
  'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 8877',
  NOW(), NOW()
),

-- 18. Audi A8
(
  'A8', 'Audi', 'luxury', 'Luxury', 'Automatic', 'Petrol', 5, 32000,
  4.9, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Matrix LED', 'Bang & Olufsen Sound', 'Massage Seats', 'Ambient Lighting'],
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 9988',
  NOW(), NOW()
),

-- 19. Lexus LS 500
(
  'LS 500', 'Lexus', 'luxury', 'Luxury', 'Automatic', 'Petrol', 5, 35000,
  5.0, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Child Seat', 'Mark Levinson Sound', 'Shiatsu Massage', 'Kiriko Glass', 'Air Suspension'],
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 1199',
  NOW(), NOW()
),

-- 20. Bentley Continental GT
(
  'Continental GT', 'Bentley', 'luxury', 'Luxury', 'Automatic', 'Petrol', 4, 45000,
  5.0, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Naim Sound', 'Diamond Quilted Leather', 'Rotating Display', 'Champagne Cooler'],
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b0?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b0?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 2200',
  NOW(), NOW()
);

-- ============================================================
-- VAN VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 21. Toyota HiAce
(
  'HiAce', 'Toyota', 'van', 'Van', 'Manual', 'Diesel', 12, 8000,
  4.4, 'Kathmandu', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Reverse Camera', 'Child Seat', 'Power Steering', 'Air Conditioning', 'Sliding Doors'],
  'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80'],
  'BA 2 PA 3311',
  NOW(), NOW()
),

-- 22. Mercedes-Benz Sprinter
(
  'Sprinter', 'Mercedes-Benz', 'van', 'Van', 'Automatic', 'Diesel', 15, 12000,
  4.6, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Reverse Camera', 'Child Seat', 'Climate Control', 'Leather Seats', 'Sliding Doors'],
  'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 4422',
  NOW(), NOW()
),

-- 23. Ford Transit
(
  'Transit', 'Ford', 'van', 'Van', 'Manual', 'Diesel', 12, 7500,
  4.3, 'Pokhara', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Reverse Camera', 'Power Steering', 'Air Conditioning', 'Sliding Doors'],
  'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80'],
  'GA 1 PA 5533',
  NOW(), NOW()
),

-- 24. Hyundai Staria
(
  'Staria', 'Hyundai', 'van', 'Van', 'Automatic', 'Diesel', 9, 10000,
  4.7, 'Chitwan', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Apple CarPlay', 'Android Auto', 'Reverse Camera', 'Child Seat', 'Ambient Lighting', 'Captain Seats', 'Sliding Doors'],
  'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=1200&q=80'],
  'NA 2 PA 6644',
  NOW(), NOW()
),

-- 25. Nissan Caravan
(
  'Caravan', 'Nissan', 'van', 'Van', 'Manual', 'Diesel', 12, 7000,
  4.2, 'Biratnagar', 'available', true, true,
  ''Bluetooth', 'USB Charging', 'Reverse Camera', 'Power Steering', 'Air Conditioning', 'Sliding Doors'],
  'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=1200&q=80'],
  'KO 1 PA 7755',
  NOW(), NOW()
);

-- ============================================================
-- ELECTRIC VEHICLES (5)
-- ============================================================

INSERT INTO vehicles (
  name, brand, type, category, transmission, fuel_type, seats, price_per_day,
  rating, location, status, available, is_active, features,
  primary_image_url, image_url, image_urls, vehicle_number,
  created_at, updated_at
) VALUES

-- 26. Tesla Model 3
(
  'Model 3', 'Tesla', 'electric', 'Electric', 'Automatic', 'Electric', 5, 9500,
  4.9, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Reverse Camera', 'Autopilot', 'Sentry Mode', 'Dog Mode', 'Supercharger Access'],
  'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 8866',
  NOW(), NOW()
),

-- 27. Tesla Model Y
(
  'Model Y', 'Tesla', 'electric', 'Electric', 'Automatic', 'Electric', 5, 11000,
  4.9, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Leather Seats', 'Heated Seats', 'Cruise Control', 'Reverse Camera', 'Child Seat', 'Autopilot', 'Sentry Mode', 'Dog Mode', 'Supercharger Access', '7 Seats'],
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 9977',
  NOW(), NOW()
),

-- 28. Hyundai Ioniq 5
(
  'Ioniq 5', 'Hyundai', 'electric', 'Electric', 'Automatic', 'Electric', 5, 8500,
  4.7, 'Lalitpur', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Sunroof', 'Cruise Control', 'Reverse Camera', 'V2L', 'Augmented Reality HUD', 'Relaxation Seats', 'Solar Roof'],
  'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=1200&q=80'],
  'BA 3 PA 1188',
  NOW(), NOW()
),

-- 29. Kia EV6
(
  'EV6', 'Kia', 'electric', 'Electric', 'Automatic', 'Electric', 5, 8000,
  4.6, 'Kathmandu', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Reverse Camera', 'V2L', 'Augmented Reality HUD', 'Meridian Sound', 'Dual Screens'],
  'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80'],
  'BA 2 PA 2299',
  NOW(), NOW()
),

-- 30. Tata Nexon EV
(
  'Nexon EV', 'Tata', 'electric', 'Electric', 'Automatic', 'Electric', 5, 5500,
  4.4, 'Bhaktapur', 'available', true, true,
  ''GPS Navigation', 'Bluetooth', 'USB Charging', 'Cruise Control', 'Reverse Camera', 'Sunroof', 'Harman Sound', 'iRA Connected'],
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=1200&q=80',
  ''https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=1200&q=80'],
  'BA 1 PA 3300',
  NOW(), NOW()
);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '✅ Successfully seeded 30 vehicles!' as message;

SELECT category, COUNT(*) as count 
FROM vehicles 
GROUP BY category 
ORDER BY category;

SELECT brand, COUNT(*) as count 
FROM vehicles 
GROUP BY brand 
ORDER BY count DESC, brand;

SELECT 'Total vehicles: ' || COUNT(*) as summary FROM vehicles;
