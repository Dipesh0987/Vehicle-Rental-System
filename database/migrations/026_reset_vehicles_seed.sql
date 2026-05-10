-- 026_reset_vehicles_seed.sql
-- Purpose: Clear all existing vehicles and seed 10 vehicles per category
--          with proper names, Nepal vehicle numbers, and image URLs.
-- Categories: Sedan, SUV, Luxury, Van, Electric, Truck  (60 total)
-- Run in Supabase SQL editor. Cascades handle vehicle_images automatically.

-- ── 1. Wipe existing data ──────────────────────────────────────────────────
-- Temporarily disable FK trigger checks so we can delete vehicles even when
-- vehicle_bookings still references them. Restored immediately after.
set session_replication_role = replica;

delete from public.vehicle_images;
delete from public.vehicles;

set session_replication_role = default;

-- ── 2. Seed new vehicles ───────────────────────────────────────────────────

-- SEDAN (10)
insert into public.vehicles
  (name, brand, type, category, transmission, fuel_type, seats, price_per_day, status, rating, vehicle_number, primary_image_url)
values
  ('Camry Hybrid 2023',    'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3500, 'available', 4.8, 'BA 1 PA 1001', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80'),
  ('Civic 2023',           'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3000, 'available', 4.7, 'BA 1 PA 1002', 'https://images.unsplash.com/photo-1611016186353-9af58c69a533?auto=format&fit=crop&w=800&q=80'),
  ('Elantra 2023',         'Hyundai',   'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2800, 'available', 4.6, 'BA 1 PA 1003', 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80'),
  ('Dzire 2023',           'Maruti',    'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2000, 'available', 4.4, 'BA 1 PA 1004', 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=800&q=80'),
  ('Cerato 2023',          'Kia',       'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3200, 'available', 4.5, 'BA 1 PA 1005', 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80'),
  ('Vento 2022',           'Volkswagen','Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2900, 'available', 4.5, 'BA 1 PA 1006', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80'),
  ('Rapid 2022',           'Skoda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2700, 'available', 4.4, 'BA 1 PA 1007', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80'),
  ('City 2023',            'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3100, 'available', 4.6, 'BA 1 PA 1008', 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80'),
  ('Yaris 2023',           'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2600, 'available', 4.5, 'BA 1 PA 1009', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80'),
  ('Aspire 2022',          'Ford',      'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2400, 'available', 4.3, 'BA 1 PA 1010', 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=800&q=80'),

-- SUV (10)
  ('Fortuner 2023',        'Toyota',    'SUV',   'SUV',   'Automatic', 'Diesel',  7, 7500, 'available', 4.9, 'BA 2 PA 2001', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'),
  ('Creta 2023',           'Hyundai',   'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5500, 'available', 4.7, 'BA 2 PA 2002', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80'),
  ('Seltos 2023',          'Kia',       'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5200, 'available', 4.7, 'BA 2 PA 2003', 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80'),
  ('CR-V 2023',            'Honda',     'SUV',   'SUV',   'Automatic', 'Petrol',  5, 6500, 'available', 4.8, 'BA 2 PA 2004', 'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=800&q=80'),
  ('Compass 2023',         'Jeep',      'SUV',   'SUV',   'Automatic', 'Diesel',  5, 6800, 'available', 4.6, 'BA 2 PA 2005', 'https://images.unsplash.com/photo-1584345604476-8ec5f82d718e?auto=format&fit=crop&w=800&q=80'),
  ('EcoSport 2022',        'Ford',      'SUV',   'SUV',   'Automatic', 'Petrol',  5, 4500, 'available', 4.5, 'BA 2 PA 2006', 'https://images.unsplash.com/photo-1510771463146-e89e6e86560e?auto=format&fit=crop&w=800&q=80'),
  ('Tiguan 2023',          'Volkswagen','SUV',   'SUV',   'Automatic', 'Petrol',  5, 7200, 'available', 4.8, 'BA 2 PA 2007', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80'),
  ('Hector Plus 2023',     'MG',        'SUV',   'SUV',   'Automatic', 'Petrol',  7, 6000, 'available', 4.5, 'BA 2 PA 2008', 'https://images.unsplash.com/photo-1483136800420-4e7b0dcfcaf5?auto=format&fit=crop&w=800&q=80'),
  ('X-Trail 2023',         'Nissan',    'SUV',   'SUV',   'Automatic', 'Petrol',  7, 7000, 'available', 4.6, 'BA 2 PA 2009', 'https://images.unsplash.com/photo-1608023136037-626dad6fa8c8?auto=format&fit=crop&w=800&q=80'),
  ('XUV700 2023',          'Mahindra',  'SUV',   'SUV',   'Automatic', 'Diesel',  7, 6500, 'available', 4.7, 'BA 2 PA 2010', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=800&q=80'),

-- LUXURY (10)
  ('E-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 18000, 'available', 4.9, 'BA 3 PA 3001', 'https://images.unsplash.com/photo-1563720360172-67b8f3dce741?auto=format&fit=crop&w=800&q=80'),
  ('5 Series 2023',        'BMW',           'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 16000, 'available', 4.9, 'BA 3 PA 3002', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80'),
  ('A6 2023',              'Audi',          'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 17000, 'available', 4.8, 'BA 3 PA 3003', 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=800&q=80'),
  ('S-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 25000, 'available', 5.0, 'BA 3 PA 3004', 'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?auto=format&fit=crop&w=800&q=80'),
  ('Defender 2023',        'Land Rover',    'Luxury', 'Luxury', 'Automatic', 'Diesel',  5, 22000, 'available', 4.9, 'BA 3 PA 3005', 'https://images.unsplash.com/photo-1617654112368-307921291f42?auto=format&fit=crop&w=800&q=80'),
  ('ES 300h 2023',         'Lexus',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 15000, 'available', 4.8, 'BA 3 PA 3006', 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&w=800&q=80'),
  ('XC90 2023',            'Volvo',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  7, 20000, 'available', 4.8, 'BA 3 PA 3007', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80'),
  ('Cayenne 2023',         'Porsche',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 23000, 'available', 4.9, 'BA 3 PA 3008', 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80'),
  ('Bentayga 2023',        'Bentley',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 35000, 'available', 5.0, 'BA 3 PA 3009', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80'),
  ('Ghost 2023',           'Rolls-Royce',   'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 45000, 'available', 5.0, 'BA 3 PA 3010', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80'),

-- VAN (10)
  ('HiAce 2023',           'Toyota',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7000, 'available', 4.7, 'BA 4 PA 4001', 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=800&q=80'),
  ('Starex 2023',          'Hyundai',   'Van',   'Van',   'Automatic', 'Diesel', 11, 6500, 'available', 4.6, 'BA 4 PA 4002', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'),
  ('Alphard 2023',         'Toyota',    'Van',   'Van',   'Automatic', 'Petrol',  7, 9000, 'available', 4.9, 'BA 4 PA 4003', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80'),
  ('Carnival 2023',        'Kia',       'Van',   'Van',   'Automatic', 'Petrol',  8, 8000, 'available', 4.8, 'BA 4 PA 4004', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'),
  ('Odyssey 2023',         'Honda',     'Van',   'Van',   'Automatic', 'Petrol',  8, 7500, 'available', 4.7, 'BA 4 PA 4005', 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80'),
  ('Sprinter 2023',        'Mercedes-Benz','Van','Van',   'Manual',    'Diesel', 15, 8500, 'available', 4.6, 'BA 4 PA 4006', 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=800&q=80'),
  ('Transit 2023',         'Ford',      'Van',   'Van',   'Manual',    'Diesel', 15, 8000, 'available', 4.5, 'BA 4 PA 4007', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'),
  ('Crafter 2023',         'Volkswagen','Van',   'Van',   'Manual',    'Diesel', 15, 8200, 'available', 4.5, 'BA 4 PA 4008', 'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?auto=format&fit=crop&w=800&q=80'),
  ('NV350 Caravan 2023',   'Nissan',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7200, 'available', 4.5, 'BA 4 PA 4009', 'https://images.unsplash.com/photo-1608023136037-626dad6fa8c8?auto=format&fit=crop&w=800&q=80'),
  ('N-Series 2023',        'Isuzu',     'Van',   'Van',   'Manual',    'Diesel', 12, 6800, 'available', 4.4, 'BA 4 PA 4010', 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80'),

-- ELECTRIC (10)
  ('Model 3 2023',         'Tesla',     'Electric','Electric','Automatic','Electric', 5, 6500, 'available', 4.9, 'BA 5 PA 5001', 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80'),
  ('Atto 3 2023',          'BYD',       'Electric','Electric','Automatic','Electric', 5, 5000, 'available', 4.6, 'BA 5 PA 5002', 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=800&q=80'),
  ('Ioniq 6 2023',         'Hyundai',   'Electric','Electric','Automatic','Electric', 5, 6000, 'available', 4.8, 'BA 5 PA 5003', 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=800&q=80'),
  ('EV6 2023',             'Kia',       'Electric','Electric','Automatic','Electric', 5, 5800, 'available', 4.8, 'BA 5 PA 5004', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80'),
  ('ID.4 2023',            'Volkswagen','Electric','Electric','Automatic','Electric', 5, 5500, 'available', 4.7, 'BA 5 PA 5005', 'https://images.unsplash.com/photo-1569069765726-3be2d1bf6bba?auto=format&fit=crop&w=800&q=80'),
  ('iX3 2023',             'BMW',       'Electric','Electric','Automatic','Electric', 5, 7000, 'available', 4.8, 'BA 5 PA 5006', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80'),
  ('Nexon EV 2023',        'Tata',      'Electric','Electric','Automatic','Electric', 5, 4500, 'available', 4.5, 'BA 5 PA 5007', 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80'),
  ('ZS EV 2023',           'MG',        'Electric','Electric','Automatic','Electric', 5, 5200, 'available', 4.6, 'BA 5 PA 5008', 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=800&q=80'),
  ('Leaf 2023',            'Nissan',    'Electric','Electric','Automatic','Electric', 5, 4800, 'available', 4.5, 'BA 5 PA 5009', 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=800&q=80'),
  ('Zoe 2023',             'Renault',   'Electric','Electric','Automatic','Electric', 5, 4000, 'available', 4.4, 'BA 5 PA 5010', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80'),

-- TRUCK (10)
  ('Hilux 2023',           'Toyota',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8500, 'available', 4.8, 'BA 6 PA 6001', 'https://images.unsplash.com/photo-1609630875171-b1321377ef65?auto=format&fit=crop&w=800&q=80'),
  ('Ranger 2023',          'Ford',      'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8000, 'available', 4.7, 'BA 6 PA 6002', 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=800&q=80'),
  ('D-Max 2023',           'Isuzu',     'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7500, 'available', 4.6, 'BA 6 PA 6003', 'https://images.unsplash.com/photo-1609630875171-b1321377ef65?auto=format&fit=crop&w=800&q=80'),
  ('Triton 2023',          'Mitsubishi','Truck',  'Truck', 'Automatic', 'Diesel',  5,  7800, 'available', 4.6, 'BA 6 PA 6004', 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=800&q=80'),
  ('Colorado 2023',        'Chevrolet', 'Truck',  'Truck', 'Automatic', 'Petrol',  5,  7200, 'available', 4.5, 'BA 6 PA 6005', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'),
  ('Navara 2023',          'Nissan',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7600, 'available', 4.6, 'BA 6 PA 6006', 'https://images.unsplash.com/photo-1609630875171-b1321377ef65?auto=format&fit=crop&w=800&q=80'),
  ('Amarok 2023',          'Volkswagen','Truck',  'Truck', 'Automatic', 'Diesel',  5,  9000, 'available', 4.7, 'BA 6 PA 6007', 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=800&q=80'),
  ('Alaskan 2023',         'Renault',   'Truck',  'Truck', 'Manual',    'Diesel',  5,  7000, 'available', 4.4, 'BA 6 PA 6008', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'),
  ('Xenon 2023',           'Tata',      'Truck',  'Truck', 'Manual',    'Diesel',  5,  6000, 'available', 4.3, 'BA 6 PA 6009', 'https://images.unsplash.com/photo-1609630875171-b1321377ef65?auto=format&fit=crop&w=800&q=80'),
  ('Scorpio Pickup 2023',  'Mahindra',  'Truck',  'Truck', 'Manual',    'Diesel',  5,  6500, 'available', 4.4, 'BA 6 PA 6010', 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=800&q=80');

-- ── 3. Notify PostgREST ────────────────────────────────────────────────────
notify pgrst, 'reload schema';
