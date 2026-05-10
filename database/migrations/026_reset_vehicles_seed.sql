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
  ('Camry Hybrid 2023',    'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3500, 'available', 4.8, 'BA 1 PA 1001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/2021_Toyota_Camry_%28XV70%2C_facelift%2C_US%29_2.0_XSE%2C_front_8.28.21.jpg/800px-2021_Toyota_Camry_%28XV70%2C_facelift%2C_US%29_2.0_XSE%2C_front_8.28.21.jpg'),
  ('Civic 2023',           'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3000, 'available', 4.7, 'BA 1 PA 1002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/2022_Honda_Civic_%28FL%29_EX_sedan%2C_front_8.18.22.jpg/800px-2022_Honda_Civic_%28FL%29_EX_sedan%2C_front_8.18.22.jpg'),
  ('Elantra 2023',         'Hyundai',   'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2800, 'available', 4.6, 'BA 1 PA 1003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/2021_Hyundai_Elantra_%28CN7%29_Limited_sedan%2C_front_10.28.20.jpg/800px-2021_Hyundai_Elantra_%28CN7%29_Limited_sedan%2C_front_10.28.20.jpg'),
  ('Dzire 2023',           'Maruti',    'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2000, 'available', 4.4, 'BA 1 PA 1004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Maruti_Suzuki_Swift_Dzire_2017.jpg/800px-Maruti_Suzuki_Swift_Dzire_2017.jpg'),
  ('Cerato 2023',          'Kia',       'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3200, 'available', 4.5, 'BA 1 PA 1005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/2019_Kia_Cerato_%28BD%29_Sport_sedan_%282018-11-02%29_01.jpg/800px-2019_Kia_Cerato_%28BD%29_Sport_sedan_%282018-11-02%29_01.jpg'),
  ('Vento 2022',           'Volkswagen','Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2900, 'available', 4.5, 'BA 1 PA 1006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Volkswagen_Vento_2014_%28India%29.jpg/800px-Volkswagen_Vento_2014_%28India%29.jpg'),
  ('Rapid 2022',           'Skoda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2700, 'available', 4.4, 'BA 1 PA 1007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Skoda_Rapid_2013.jpg/800px-Skoda_Rapid_2013.jpg'),
  ('City 2023',            'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3100, 'available', 4.6, 'BA 1 PA 1008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Honda_City_2020_Facelift_%28Thailand%29.jpg/800px-Honda_City_2020_Facelift_%28Thailand%29.jpg'),
  ('Yaris 2023',           'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2600, 'available', 4.5, 'BA 1 PA 1009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/2020_Toyota_Yaris_%28XP210%29_GR_SPORT_%28UK%29%2C_front_8.10.20.jpg/800px-2020_Toyota_Yaris_%28XP210%29_GR_SPORT_%28UK%29%2C_front_8.10.20.jpg'),
  ('Aspire 2022',          'Ford',      'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2400, 'available', 4.3, 'BA 1 PA 1010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/2018_Ford_Aspire_S_%28India%29.jpg/800px-2018_Ford_Aspire_S_%28India%29.jpg'),

-- SUV (10)
  ('Fortuner 2023',        'Toyota',    'SUV',   'SUV',   'Automatic', 'Diesel',  7, 7500, 'available', 4.9, 'BA 2 PA 2001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/2020_Toyota_Fortuner_GXL_%28Australia%29.jpg/800px-2020_Toyota_Fortuner_GXL_%28Australia%29.jpg'),
  ('Creta 2023',           'Hyundai',   'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5500, 'available', 4.7, 'BA 2 PA 2002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/2021_Hyundai_Creta_%28GS%29_CRDi_S%2B_%28India%29.jpg/800px-2021_Hyundai_Creta_%28GS%29_CRDi_S%2B_%28India%29.jpg'),
  ('Seltos 2023',          'Kia',       'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5200, 'available', 4.7, 'BA 2 PA 2003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/2022_Kia_Seltos_EX_SUV%2C_front_3.28.22.jpg/800px-2022_Kia_Seltos_EX_SUV%2C_front_3.28.22.jpg'),
  ('CR-V 2023',            'Honda',     'SUV',   'SUV',   'Automatic', 'Petrol',  5, 6500, 'available', 4.8, 'BA 2 PA 2004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/2023_Honda_CR-V_e%3APHEV_Advance_Tech_%28UK%29%2C_front_10.11.23.jpg/800px-2023_Honda_CR-V_e%3APHEV_Advance_Tech_%28UK%29%2C_front_10.11.23.jpg'),
  ('Compass 2023',         'Jeep',      'SUV',   'SUV',   'Automatic', 'Diesel',  5, 6800, 'available', 4.6, 'BA 2 PA 2005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/2021_Jeep_Compass_%28facelift%2C_India%29_front.jpg/800px-2021_Jeep_Compass_%28facelift%2C_India%29_front.jpg'),
  ('EcoSport 2022',        'Ford',      'SUV',   'SUV',   'Automatic', 'Petrol',  5, 4500, 'available', 4.5, 'BA 2 PA 2006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/2021_Ford_EcoSport_%28facelift%2C_India%29.jpg/800px-2021_Ford_EcoSport_%28facelift%2C_India%29.jpg'),
  ('Tiguan 2023',          'Volkswagen','SUV',   'SUV',   'Automatic', 'Petrol',  5, 7200, 'available', 4.8, 'BA 2 PA 2007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/2022_Volkswagen_Tiguan_%28AD1%29_110TDI_SUV_%28Australia%29.jpg/800px-2022_Volkswagen_Tiguan_%28AD1%29_110TDI_SUV_%28Australia%29.jpg'),
  ('Hector Plus 2023',     'MG',        'SUV',   'SUV',   'Automatic', 'Petrol',  7, 6000, 'available', 4.5, 'BA 2 PA 2008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/MG_Hector_Plus_Sharp_Pro_6-seater_%28India%2C_2021%29.jpg/800px-MG_Hector_Plus_Sharp_Pro_6-seater_%28India%2C_2021%29.jpg'),
  ('X-Trail 2023',         'Nissan',    'SUV',   'SUV',   'Automatic', 'Petrol',  7, 7000, 'available', 4.6, 'BA 2 PA 2009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/2022_Nissan_X-Trail_e-4ORCE_%28T33%2C_Japan%29.jpg/800px-2022_Nissan_X-Trail_e-4ORCE_%28T33%2C_Japan%29.jpg'),
  ('XUV700 2023',          'Mahindra',  'SUV',   'SUV',   'Automatic', 'Diesel',  7, 6500, 'available', 4.7, 'BA 2 PA 2010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/2021_Mahindra_XUV700_AX7_L_AWD_front.jpg/800px-2021_Mahindra_XUV700_AX7_L_AWD_front.jpg'),

-- LUXURY (10)
  ('E-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 18000, 'available', 4.9, 'BA 3 PA 3001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/2021_Mercedes-Benz_E300_AMG_Line_%28W213%2C_facelift%29_front.jpg/800px-2021_Mercedes-Benz_E300_AMG_Line_%28W213%2C_facelift%29_front.jpg'),
  ('5 Series 2023',        'BMW',           'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 16000, 'available', 4.9, 'BA 3 PA 3002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/2021_BMW_530i_%28G30%2C_facelift%2C_UK%29_front.jpg/800px-2021_BMW_530i_%28G30%2C_facelift%2C_UK%29_front.jpg'),
  ('A6 2023',              'Audi',          'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 17000, 'available', 4.8, 'BA 3 PA 3003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/2022_Audi_A6_40_TDI_S_line_%28UK%29%2C_front.jpg/800px-2022_Audi_A6_40_TDI_S_line_%28UK%29%2C_front.jpg'),
  ('S-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 25000, 'available', 5.0, 'BA 3 PA 3004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/2021_Mercedes-Benz_S500_%28W223%29%2C_front_10.26.20.jpg/800px-2021_Mercedes-Benz_S500_%28W223%29%2C_front_10.26.20.jpg'),
  ('Defender 2023',        'Land Rover',    'Luxury', 'Luxury', 'Automatic', 'Diesel',  5, 22000, 'available', 4.9, 'BA 3 PA 3005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/2020_Land_Rover_Defender_110_P300_SE_first_edition%2C_front_8.17.20.jpg/800px-2020_Land_Rover_Defender_110_P300_SE_first_edition%2C_front_8.17.20.jpg'),
  ('ES 300h 2023',         'Lexus',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 15000, 'available', 4.8, 'BA 3 PA 3006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/2019_Lexus_ES_300h_F_Sport%2C_front_8.14.20.jpg/800px-2019_Lexus_ES_300h_F_Sport%2C_front_8.14.20.jpg'),
  ('XC90 2023',            'Volvo',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  7, 20000, 'available', 4.8, 'BA 3 PA 3007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/2020_Volvo_XC90_%28facelift%2C_UK%29_R-Design_T8_front.jpg/800px-2020_Volvo_XC90_%28facelift%2C_UK%29_R-Design_T8_front.jpg'),
  ('Cayenne 2023',         'Porsche',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 23000, 'available', 4.9, 'BA 3 PA 3008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/2019_Porsche_Cayenne_%28PO536%29_S_front.jpg/800px-2019_Porsche_Cayenne_%28PO536%29_S_front.jpg'),
  ('Bentayga 2023',        'Bentley',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 35000, 'available', 5.0, 'BA 3 PA 3009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/2021_Bentley_Bentayga_V8_%28facelift%29_front.jpg/800px-2021_Bentley_Bentayga_V8_%28facelift%29_front.jpg'),
  ('Ghost 2023',           'Rolls-Royce',   'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 45000, 'available', 5.0, 'BA 3 PA 3010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/2021_Rolls-Royce_Ghost_%28RR31%29_front_10.26.20.jpg/800px-2021_Rolls-Royce_Ghost_%28RR31%29_front_10.26.20.jpg'),

-- VAN (10)
  ('HiAce 2023',           'Toyota',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7000, 'available', 4.7, 'BA 4 PA 4001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/2019_Toyota_HiAce_%28GDH300%29_Commuter_van_%28Australia%29.jpg/800px-2019_Toyota_HiAce_%28GDH300%29_Commuter_van_%28Australia%29.jpg'),
  ('Starex 2023',          'Hyundai',   'Van',   'Van',   'Automatic', 'Diesel', 11, 6500, 'available', 4.6, 'BA 4 PA 4002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/2019_Hyundai_Starex_%28A2%29_Urban_%28facelift%2C_Korea%29.jpg/800px-2019_Hyundai_Starex_%28A2%29_Urban_%28facelift%2C_Korea%29.jpg'),
  ('Alphard 2023',         'Toyota',    'Van',   'Van',   'Automatic', 'Petrol',  7, 9000, 'available', 4.9, 'BA 4 PA 4003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Toyota_Alphard_hybrid_AGH30_1st_cf.jpg/800px-Toyota_Alphard_hybrid_AGH30_1st_cf.jpg'),
  ('Carnival 2023',        'Kia',       'Van',   'Van',   'Automatic', 'Petrol',  8, 8000, 'available', 4.8, 'BA 4 PA 4004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/2022_Kia_Carnival_SX_minivan%2C_front_6.3.22.jpg/800px-2022_Kia_Carnival_SX_minivan%2C_front_6.3.22.jpg'),
  ('Odyssey 2023',         'Honda',     'Van',   'Van',   'Automatic', 'Petrol',  8, 7500, 'available', 4.7, 'BA 4 PA 4005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/2021_Honda_Odyssey_EX-L%2C_front_6.18.21.jpg/800px-2021_Honda_Odyssey_EX-L%2C_front_6.18.21.jpg'),
  ('Sprinter 2023',        'Mercedes-Benz','Van','Van',   'Manual',    'Diesel', 15, 8500, 'available', 4.6, 'BA 4 PA 4006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Mercedes-Benz_Sprinter_W907_front_20190105.jpg/800px-Mercedes-Benz_Sprinter_W907_front_20190105.jpg'),
  ('Transit 2023',         'Ford',      'Van',   'Van',   'Manual',    'Diesel', 15, 8000, 'available', 4.5, 'BA 4 PA 4007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Ford_Transit_Custom_2020.jpg/800px-Ford_Transit_Custom_2020.jpg'),
  ('Crafter 2023',         'Volkswagen','Van',   'Van',   'Manual',    'Diesel', 15, 8200, 'available', 4.5, 'BA 4 PA 4008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Volkswagen_Crafter_2017_front.jpg/800px-Volkswagen_Crafter_2017_front.jpg'),
  ('NV350 Caravan 2023',   'Nissan',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7200, 'available', 4.5, 'BA 4 PA 4009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/2012_Nissan_NV350_Caravan_%28E26%29_Premium_GX_van.jpg/800px-2012_Nissan_NV350_Caravan_%28E26%29_Premium_GX_van.jpg'),
  ('N-Series 2023',        'Isuzu',     'Van',   'Van',   'Manual',    'Diesel', 12, 6800, 'available', 4.4, 'BA 4 PA 4010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/2019_Isuzu_NMR_85L_truck.jpg/800px-2019_Isuzu_NMR_85L_truck.jpg'),

-- ELECTRIC (10)
  ('Model 3 2023',         'Tesla',     'Electric','Electric','Automatic','Electric', 5, 6500, 'available', 4.9, 'BA 5 PA 5001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/2019_Tesla_Model_3_Performance_AWD_%28UK%29%2C_front_8.27.19.jpg/800px-2019_Tesla_Model_3_Performance_AWD_%28UK%29%2C_front_8.27.19.jpg'),
  ('Atto 3 2023',          'BYD',       'Electric','Electric','Automatic','Electric', 5, 5000, 'available', 4.6, 'BA 5 PA 5002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/2022_BYD_Atto_3_%28ATTO3%29_front_cropped.jpg/800px-2022_BYD_Atto_3_%28ATTO3%29_front_cropped.jpg'),
  ('Ioniq 6 2023',         'Hyundai',   'Electric','Electric','Automatic','Electric', 5, 6000, 'available', 4.8, 'BA 5 PA 5003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/2023_Hyundai_IONIQ_6_%28CE%29_Standard_Range_2WD%2C_front_3.14.23.jpg/800px-2023_Hyundai_IONIQ_6_%28CE%29_Standard_Range_2WD%2C_front_3.14.23.jpg'),
  ('EV6 2023',             'Kia',       'Electric','Electric','Automatic','Electric', 5, 5800, 'available', 4.8, 'BA 5 PA 5004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/2021_Kia_EV6_%28CV%29_GT-Line_AWD%2C_front_8.15.21.jpg/800px-2021_Kia_EV6_%28CV%29_GT-Line_AWD%2C_front_8.15.21.jpg'),
  ('ID.4 2023',            'Volkswagen','Electric','Electric','Automatic','Electric', 5, 5500, 'available', 4.7, 'BA 5 PA 5005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/2021_Volkswagen_ID.4_1ST_Edition_%28EU-spec%29%2C_front_8.13.21.jpg/800px-2021_Volkswagen_ID.4_1ST_Edition_%28EU-spec%29%2C_front_8.13.21.jpg'),
  ('iX3 2023',             'BMW',       'Electric','Electric','Automatic','Electric', 5, 7000, 'available', 4.8, 'BA 5 PA 5006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/2021_BMW_iX3_%28G08%29%2C_front_10.27.20.jpg/800px-2021_BMW_iX3_%28G08%29%2C_front_10.27.20.jpg'),
  ('Nexon EV 2023',        'Tata',      'Electric','Electric','Automatic','Electric', 5, 4500, 'available', 4.5, 'BA 5 PA 5007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Tata_Nexon_EV_Max_XZ%2B_front.jpg/800px-Tata_Nexon_EV_Max_XZ%2B_front.jpg'),
  ('ZS EV 2023',           'MG',        'Electric','Electric','Automatic','Electric', 5, 5200, 'available', 4.6, 'BA 5 PA 5008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/2020_MG_ZS_EV_Exclusive%2C_front_9.17.20.jpg/800px-2020_MG_ZS_EV_Exclusive%2C_front_9.17.20.jpg'),
  ('Leaf 2023',            'Nissan',    'Electric','Electric','Automatic','Electric', 5, 4800, 'available', 4.5, 'BA 5 PA 5009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/2018_Nissan_Leaf_%28ZE1%29_front_8.28.20.jpg/800px-2018_Nissan_Leaf_%28ZE1%29_front_8.28.20.jpg'),
  ('Zoe 2023',             'Renault',   'Electric','Electric','Automatic','Electric', 5, 4000, 'available', 4.4, 'BA 5 PA 5010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/2020_Renault_Zoe_%28ZE50%29_R135_front.jpg/800px-2020_Renault_Zoe_%28ZE50%29_R135_front.jpg'),

-- TRUCK (10)
  ('Hilux 2023',           'Toyota',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8500, 'available', 4.8, 'BA 6 PA 6001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/2020_Toyota_Hilux_%28AN120%29_GXL_pick-up_%28Australia%29.jpg/800px-2020_Toyota_Hilux_%28AN120%29_GXL_pick-up_%28Australia%29.jpg'),
  ('Ranger 2023',          'Ford',      'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8000, 'available', 4.7, 'BA 6 PA 6002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/2023_Ford_Ranger_Wildtrak_front.jpg/800px-2023_Ford_Ranger_Wildtrak_front.jpg'),
  ('D-Max 2023',           'Isuzu',     'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7500, 'available', 4.6, 'BA 6 PA 6003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/2021_Isuzu_D-Max_%28TFR_86%29_Space_Cab%2C_front_11.2.21.jpg/800px-2021_Isuzu_D-Max_%28TFR_86%29_Space_Cab%2C_front_11.2.21.jpg'),
  ('Triton 2023',          'Mitsubishi','Truck',  'Truck', 'Automatic', 'Diesel',  5,  7800, 'available', 4.6, 'BA 6 PA 6004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/2020_Mitsubishi_Triton_%28KL1T%29_GLX_pickup_%28Australia%29.jpg/800px-2020_Mitsubishi_Triton_%28KL1T%29_GLX_pickup_%28Australia%29.jpg'),
  ('Colorado 2023',        'Chevrolet', 'Truck',  'Truck', 'Automatic', 'Petrol',  5,  7200, 'available', 4.5, 'BA 6 PA 6005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/2021_Chevrolet_Colorado_Z71_Crew_Cab%2C_front_8.31.20.jpg/800px-2021_Chevrolet_Colorado_Z71_Crew_Cab%2C_front_8.31.20.jpg'),
  ('Navara 2023',          'Nissan',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7600, 'available', 4.6, 'BA 6 PA 6006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/2021_Nissan_Navara_%28D23%2C_facelift%29_SL_pick-up_%28Australia%29.jpg/800px-2021_Nissan_Navara_%28D23%2C_facelift%29_SL_pick-up_%28Australia%29.jpg'),
  ('Amarok 2023',          'Volkswagen','Truck',  'Truck', 'Automatic', 'Diesel',  5,  9000, 'available', 4.7, 'BA 6 PA 6007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/2023_Volkswagen_Amarok_V6_Style_%28UK%29%2C_front.jpg/800px-2023_Volkswagen_Amarok_V6_Style_%28UK%29%2C_front.jpg'),
  ('Alaskan 2023',         'Renault',   'Truck',  'Truck', 'Manual',    'Diesel',  5,  7000, 'available', 4.4, 'BA 6 PA 6008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/2018_Renault_Alaskan_Intens_double_cab_%28Australia%29.jpg/800px-2018_Renault_Alaskan_Intens_double_cab_%28Australia%29.jpg'),
  ('Xenon 2023',           'Tata',      'Truck',  'Truck', 'Manual',    'Diesel',  5,  6000, 'available', 4.3, 'BA 6 PA 6009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Tata_Xenon_XT.jpg/800px-Tata_Xenon_XT.jpg'),
  ('Scorpio Pickup 2023',  'Mahindra',  'Truck',  'Truck', 'Manual',    'Diesel',  5,  6500, 'available', 4.4, 'BA 6 PA 6010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Mahindra_Scorpio_Getaway_2011.jpg/800px-Mahindra_Scorpio_Getaway_2011.jpg');

-- ── 3. Notify PostgREST ────────────────────────────────────────────────────
notify pgrst, 'reload schema';
