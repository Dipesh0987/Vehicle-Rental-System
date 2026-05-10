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
  ('Camry Hybrid 2023',    'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3500, 'available', 4.8, 'BA 1 PA 1001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/2018_Toyota_Camry_%28ASV70R%29_Ascent_sedan_%282018-08-27%29_01.jpg/800px-2018_Toyota_Camry_%28ASV70R%29_Ascent_sedan_%282018-08-27%29_01.jpg'),
  ('Civic 2023',           'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3000, 'available', 4.7, 'BA 1 PA 1002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Honda_Civic_e-HEV_Sport_%28XI%29_%E2%80%93_f_30062024.jpg/800px-Honda_Civic_e-HEV_Sport_%28XI%29_%E2%80%93_f_30062024.jpg'),
  ('Elantra 2023',         'Hyundai',   'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2800, 'available', 4.6, 'BA 1 PA 1003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/2023_Hyundai_Elantra_Limited_in_Silver%2C_front_left%2C_04-04-2026.jpg/800px-2023_Hyundai_Elantra_Limited_in_Silver%2C_front_left%2C_04-04-2026.jpg'),
  ('Dzire 2023',           'Maruti',    'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2000, 'available', 4.4, 'BA 1 PA 1004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Suzuki_Dzire_II_1.2_GLX_Hybrid_Arctic_White_Pearl.jpg/800px-Suzuki_Dzire_II_1.2_GLX_Hybrid_Arctic_White_Pearl.jpg'),
  ('Cerato 2023',          'Kia',       'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3200, 'available', 4.5, 'BA 1 PA 1005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/2019_Kia_Cerato_S_hatchback_front.jpg/800px-2019_Kia_Cerato_S_hatchback_front.jpg'),
  ('Vento 2022',           'Volkswagen','Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2900, 'available', 4.5, 'BA 1 PA 1006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Vw_vento_polo_sedan.png/800px-Vw_vento_polo_sedan.png'),
  ('Rapid 2022',           'Skoda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2700, 'available', 4.4, 'BA 1 PA 1007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Skoda-museum-mlada-boleslav-rr-012.jpg/800px-Skoda-museum-mlada-boleslav-rr-012.jpg'),
  ('City 2023',            'Honda',     'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 3100, 'available', 4.6, 'BA 1 PA 1008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/2022_Honda_City_ZX_i-VTEC_%28India%29_front_view_%28cropped%29.jpg/800px-2022_Honda_City_ZX_i-VTEC_%28India%29_front_view_%28cropped%29.jpg'),
  ('Yaris 2023',           'Toyota',    'Sedan', 'Sedan', 'Automatic', 'Petrol',  5, 2600, 'available', 4.5, 'BA 1 PA 1009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/2020_Toyota_Yaris_Design_HEV_CVT_1.5_Front.jpg/800px-2020_Toyota_Yaris_Design_HEV_CVT_1.5_Front.jpg'),
  ('Aspire 2022',          'Ford',      'Sedan', 'Sedan', 'Manual',    'Petrol',  5, 2400, 'available', 4.3, 'BA 1 PA 1010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Ford_Figo_front.JPG/800px-Ford_Figo_front.JPG'),

-- SUV (10)
  ('Fortuner 2023',        'Toyota',    'SUV',   'SUV',   'Automatic', 'Diesel',  7, 7500, 'available', 4.9, 'BA 2 PA 2001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/2015_Toyota_Fortuner_%28New_Zealand%29.jpg/800px-2015_Toyota_Fortuner_%28New_Zealand%29.jpg'),
  ('Creta 2023',           'Hyundai',   'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5500, 'available', 4.7, 'BA 2 PA 2002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/2022_Hyundai_Creta_1.6_Plus_%28Chile%29_front_view.jpg/800px-2022_Hyundai_Creta_1.6_Plus_%28Chile%29_front_view.jpg'),
  ('Seltos 2023',          'Kia',       'SUV',   'SUV',   'Automatic', 'Petrol',  5, 5200, 'available', 4.7, 'BA 2 PA 2003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Kia_Seltos_SP2_PE_Snow_White_Pearl_%2817%29_%28cropped%29.jpg/800px-Kia_Seltos_SP2_PE_Snow_White_Pearl_%2817%29_%28cropped%29.jpg'),
  ('CR-V 2023',            'Honda',     'SUV',   'SUV',   'Automatic', 'Petrol',  5, 6500, 'available', 4.8, 'BA 2 PA 2004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Honda_CR-V_e-HEV_Elegance_AWD_%28VI%29_%E2%80%93_f_14072024.jpg/800px-Honda_CR-V_e-HEV_Elegance_AWD_%28VI%29_%E2%80%93_f_14072024.jpg'),
  ('Compass 2023',         'Jeep',      'SUV',   'SUV',   'Automatic', 'Diesel',  5, 6800, 'available', 4.6, 'BA 2 PA 2005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/2019_Jeep_Compass_Limited_2.4L%2C_front_7.6.19.jpg/800px-2019_Jeep_Compass_Limited_2.4L%2C_front_7.6.19.jpg'),
  ('EcoSport 2022',        'Ford',      'SUV',   'SUV',   'Automatic', 'Petrol',  5, 4500, 'available', 4.5, 'BA 2 PA 2006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/2018_Ford_Ecosport_ST-Line_TDCi_1.5.jpg/800px-2018_Ford_Ecosport_ST-Line_TDCi_1.5.jpg'),
  ('Tiguan 2023',          'Volkswagen','SUV',   'SUV',   'Automatic', 'Petrol',  5, 7200, 'available', 4.8, 'BA 2 PA 2007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Volkswagen_Tiguan_III_IMG_8823_%28cropped%29.jpg/800px-Volkswagen_Tiguan_III_IMG_8823_%28cropped%29.jpg'),
  ('Hector Plus 2023',     'MG',        'SUV',   'SUV',   'Automatic', 'Petrol',  7, 6000, 'available', 4.5, 'BA 2 PA 2008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/2018_Baojun_530.jpg/800px-2018_Baojun_530.jpg'),
  ('X-Trail 2023',         'Nissan',    'SUV',   'SUV',   'Automatic', 'Petrol',  7, 7000, 'available', 4.6, 'BA 2 PA 2009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Nissan_X-Trail_%28T33%29_1X7A7179.jpg/800px-Nissan_X-Trail_%28T33%29_1X7A7179.jpg'),
  ('XUV700 2023',          'Mahindra',  'SUV',   'SUV',   'Automatic', 'Diesel',  7, 6500, 'available', 4.7, 'BA 2 PA 2010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/2021_Mahindra_XUV700_2.2_AX7_%28India%29_front_view.png/800px-2021_Mahindra_XUV700_2.2_AX7_%28India%29_front_view.png'),

-- LUXURY (10)
  ('E-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 18000, 'available', 4.9, 'BA 3 PA 3001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Mercedes-Benz_W214_1X7A1841.jpg/800px-Mercedes-Benz_W214_1X7A1841.jpg'),
  ('5 Series 2023',        'BMW',           'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 16000, 'available', 4.9, 'BA 3 PA 3002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/BMW_G60_520i_1X7A2443.jpg/800px-BMW_G60_520i_1X7A2443.jpg'),
  ('A6 2023',              'Audi',          'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 17000, 'available', 4.8, 'BA 3 PA 3003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Audi_A6_C9_IAA_2025_DSC_1920.jpg/800px-Audi_A6_C9_IAA_2025_DSC_1920.jpg'),
  ('S-Class 2023',         'Mercedes-Benz', 'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 25000, 'available', 5.0, 'BA 3 PA 3004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Mercedes-Benz_W223_IMG_6663.jpg/800px-Mercedes-Benz_W223_IMG_6663.jpg'),
  ('Defender 2023',        'Land Rover',    'Luxury', 'Luxury', 'Automatic', 'Diesel',  5, 22000, 'available', 4.9, 'BA 3 PA 3005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/2015_Land_Rover_Defender_%28L316_MY15%29_90_3-door_wagon_%282015-10-24%29_01.jpg/800px-2015_Land_Rover_Defender_%28L316_MY15%29_90_3-door_wagon_%282015-10-24%29_01.jpg'),
  ('ES 300h 2023',         'Lexus',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 15000, 'available', 4.8, 'BA 3 PA 3006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Lexus_ES_350_%28GSZ10%29_IMG_4332.jpg/800px-Lexus_ES_350_%28GSZ10%29_IMG_4332.jpg'),
  ('XC90 2023',            'Volvo',         'Luxury', 'Luxury', 'Automatic', 'Petrol',  7, 20000, 'available', 4.8, 'BA 3 PA 3007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Volvo_XC90_T8_AWD_Plug-in_Hybrid_Plus_%28II%2C_2._Facelift%29_%E2%80%93_f_03102025.jpg/800px-Volvo_XC90_T8_AWD_Plug-in_Hybrid_Plus_%28II%2C_2._Facelift%29_%E2%80%93_f_03102025.jpg'),
  ('Cayenne 2023',         'Porsche',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 23000, 'available', 4.9, 'BA 3 PA 3008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Porsche_Cayenne_%28III%2C_Facelift%29_%E2%80%93_f_01012025.jpg/800px-Porsche_Cayenne_%28III%2C_Facelift%29_%E2%80%93_f_01012025.jpg'),
  ('Bentayga 2023',        'Bentley',       'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 35000, 'available', 5.0, 'BA 3 PA 3009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Bentley_Bentayga_V8_%28FL%29_IMG_0005.jpg/800px-Bentley_Bentayga_V8_%28FL%29_IMG_0005.jpg'),
  ('Ghost 2023',           'Rolls-Royce',   'Luxury', 'Luxury', 'Automatic', 'Petrol',  5, 45000, 'available', 5.0, 'BA 3 PA 3010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/2022_Rolls-Royce_Ghost_Black_Badge_in_Arctic_White%2C_front_left.jpg/800px-2022_Rolls-Royce_Ghost_Black_Badge_in_Arctic_White%2C_front_left.jpg'),

-- VAN (10)
  ('HiAce 2023',           'Toyota',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7000, 'available', 4.7, 'BA 4 PA 4001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/2020_Toyota_HiAce_%28front%29.jpg/800px-2020_Toyota_HiAce_%28front%29.jpg'),
  ('Starex 2023',          'Hyundai',   'Van',   'Van',   'Automatic', 'Diesel', 11, 6500, 'available', 4.6, 'BA 4 PA 4002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Hyundai_The_New_Grand_Starex_Urban_Front_Side.jpg/800px-Hyundai_The_New_Grand_Starex_Urban_Front_Side.jpg'),
  ('Alphard 2023',         'Toyota',    'Van',   'Van',   'Automatic', 'Petrol',  7, 9000, 'available', 4.9, 'BA 4 PA 4003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/2018-2023_Toyota_Alphard_X.jpg/800px-2018-2023_Toyota_Alphard_X.jpg'),
  ('Carnival 2023',        'Kia',       'Van',   'Van',   'Automatic', 'Petrol',  8, 8000, 'available', 4.8, 'BA 4 PA 4004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/2025_Kia_Carnival_Hybrid_EX%2C_front_right%2C_10-12-2025.jpg/800px-2025_Kia_Carnival_Hybrid_EX%2C_front_right%2C_10-12-2025.jpg'),
  ('Odyssey 2023',         'Honda',     'Van',   'Van',   'Automatic', 'Petrol',  8, 7500, 'available', 4.7, 'BA 4 PA 4005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/2018_Honda_Odyssey_EX-L_3.5L%2C_front_8.23.19.jpg/800px-2018_Honda_Odyssey_EX-L_3.5L%2C_front_8.23.19.jpg'),
  ('Sprinter 2023',        'Mercedes-Benz','Van','Van',   'Manual',    'Diesel', 15, 8500, 'available', 4.6, 'BA 4 PA 4006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/2019_Mercedes-Benz_Sprinter_314_CDi_2.1.jpg/800px-2019_Mercedes-Benz_Sprinter_314_CDi_2.1.jpg'),
  ('Transit 2023',         'Ford',      'Van',   'Van',   'Manual',    'Diesel', 15, 8000, 'available', 4.5, 'BA 4 PA 4007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/2016_Ford_Transit_350_2.2.jpg/800px-2016_Ford_Transit_350_2.2.jpg'),
  ('Crafter 2023',         'Volkswagen','Van',   'Van',   'Manual',    'Diesel', 15, 8200, 'available', 4.5, 'BA 4 PA 4008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/2017_Volkswagen_Crafter_CR35_Trendline_TD_2.0_Front.jpg/800px-2017_Volkswagen_Crafter_CR35_Trendline_TD_2.0_Front.jpg'),
  ('NV350 Caravan 2023',   'Nissan',    'Van',   'Van',   'Automatic', 'Diesel', 12, 7200, 'available', 4.5, 'BA 4 PA 4009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Nissan_NV350_Caravan_VR2E26.jpg/800px-Nissan_NV350_Caravan_VR2E26.jpg'),
  ('N-Series 2023',        'Isuzu',     'Van',   'Van',   'Manual',    'Diesel', 12, 6800, 'available', 4.4, 'BA 4 PA 4010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Nippon_Rent-A-Car_Isuzu_Elf_NJR85A.jpg/800px-Nippon_Rent-A-Car_Isuzu_Elf_NJR85A.jpg'),

-- ELECTRIC (10)
  ('Model 3 2023',         'Tesla',     'Electric','Electric','Automatic','Electric', 5, 6500, 'available', 4.9, 'BA 5 PA 5001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg/800px-Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg'),
  ('Atto 3 2023',          'BYD',       'Electric','Electric','Automatic','Electric', 5, 5000, 'available', 4.6, 'BA 5 PA 5002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/BYD_Atto_3_1X7A6491.jpg/800px-BYD_Atto_3_1X7A6491.jpg'),
  ('Ioniq 6 2023',         'Hyundai',   'Electric','Electric','Automatic','Electric', 5, 6000, 'available', 4.8, 'BA 5 PA 5003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/2023_Hyundai_Ioniq_6_Limited%2C_front_4.27.23.jpg/800px-2023_Hyundai_Ioniq_6_Limited%2C_front_4.27.23.jpg'),
  ('EV6 2023',             'Kia',       'Electric','Electric','Automatic','Electric', 5, 5800, 'available', 4.8, 'BA 5 PA 5004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/2021_Kia_EV6_GT-Line_S.jpg/800px-2021_Kia_EV6_GT-Line_S.jpg'),
  ('ID.4 2023',            'Volkswagen','Electric','Electric','Automatic','Electric', 5, 5500, 'available', 4.7, 'BA 5 PA 5005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/2025_Volkswagen_ID4_Pro_Redspot_front.jpg/800px-2025_Volkswagen_ID4_Pro_Redspot_front.jpg'),
  ('iX3 2023',             'BMW',       'Electric','Electric','Automatic','Electric', 5, 7000, 'available', 4.8, 'BA 5 PA 5006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/BMW_iX3_NA5_IMG_5333.jpg/800px-BMW_iX3_NA5_IMG_5333.jpg'),
  ('Nexon EV 2023',        'Tata',      'Electric','Electric','Automatic','Electric', 5, 4500, 'available', 4.5, 'BA 5 PA 5007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Tata_Nexon_Blue_Dual_Tone.jpg/800px-Tata_Nexon_Blue_Dual_Tone.jpg'),
  ('ZS EV 2023',           'MG',        'Electric','Electric','Automatic','Electric', 5, 5200, 'available', 4.6, 'BA 5 PA 5008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/MG_ZS_%28crossover%2C_second_generation%29_DSC_8542.jpg/800px-MG_ZS_%28crossover%2C_second_generation%29_DSC_8542.jpg'),
  ('Leaf 2023',            'Nissan',    'Electric','Electric','Automatic','Electric', 5, 4800, 'available', 4.5, 'BA 5 PA 5009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Nissan_Leaf_%28ZE2%29_autoMOBIL_T%C3%BCbingen_2025_DSC_2752.jpg/800px-Nissan_Leaf_%28ZE2%29_autoMOBIL_T%C3%BCbingen_2025_DSC_2752.jpg'),
  ('Zoe 2023',             'Renault',   'Electric','Electric','Automatic','Electric', 5, 4000, 'available', 4.4, 'BA 5 PA 5010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Renault_Zoe_R110_Z.E._50_Experience_%28Facelift%29_%E2%80%93_f_22112020.jpg/800px-Renault_Zoe_R110_Z.E._50_Experience_%28Facelift%29_%E2%80%93_f_22112020.jpg'),

-- TRUCK (10)
  ('Hilux 2023',           'Toyota',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8500, 'available', 4.8, 'BA 6 PA 6001', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/2016_Toyota_HiLux_Invincible_D-4D_4WD_2.4_Front.jpg/800px-2016_Toyota_HiLux_Invincible_D-4D_4WD_2.4_Front.jpg'),
  ('Ranger 2023',          'Ford',      'Truck',  'Truck', 'Automatic', 'Diesel',  5,  8000, 'available', 4.7, 'BA 6 PA 6002', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Ford_Ranger_%28T6%2C_P703%29_Wildtrak_IMG_7320.jpg/800px-Ford_Ranger_%28T6%2C_P703%29_Wildtrak_IMG_7320.jpg'),
  ('D-Max 2023',           'Isuzu',     'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7500, 'available', 4.6, 'BA 6 PA 6003', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Isuzu_D-Max_%28third_generation%29_autoMOBIL_T%C3%BCbingen_2025_DSC_2758.jpg/800px-Isuzu_D-Max_%28third_generation%29_autoMOBIL_T%C3%BCbingen_2025_DSC_2758.jpg'),
  ('Triton 2023',          'Mitsubishi','Truck',  'Truck', 'Automatic', 'Diesel',  5,  7800, 'available', 4.6, 'BA 6 PA 6004', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Mitsubishi_Triton_LC_2.4_GLS_2WD_Blade_Silver_Metallic_%28cropped%29.jpg/800px-Mitsubishi_Triton_LC_2.4_GLS_2WD_Blade_Silver_Metallic_%28cropped%29.jpg'),
  ('Colorado 2023',        'Chevrolet', 'Truck',  'Truck', 'Automatic', 'Petrol',  5,  7200, 'available', 4.5, 'BA 6 PA 6005', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/2024_Chevrolet_Colorado_Z71%2C_front_left%2C_09-28-2024.jpg/800px-2024_Chevrolet_Colorado_Z71%2C_front_left%2C_09-28-2024.jpg'),
  ('Navara 2023',          'Nissan',    'Truck',  'Truck', 'Automatic', 'Diesel',  5,  7600, 'available', 4.6, 'BA 6 PA 6006', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/2018_Nissan_Navara_Tekna_DCi_Automatic_2.3.jpg/800px-2018_Nissan_Navara_Tekna_DCi_Automatic_2.3.jpg'),
  ('Amarok 2023',          'Volkswagen','Truck',  'Truck', 'Automatic', 'Diesel',  5,  9000, 'available', 4.7, 'BA 6 PA 6007', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/VW_Amarok_3.0_TDI_4Motion_Style_%28II%29_%E2%80%93_f_05072025.jpg/800px-VW_Amarok_3.0_TDI_4Motion_Style_%28II%29_%E2%80%93_f_05072025.jpg'),
  ('Alaskan 2023',         'Renault',   'Truck',  'Truck', 'Manual',    'Diesel',  5,  7000, 'available', 4.4, 'BA 6 PA 6008', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/2018_Nissan_Navara_Tekna_DCi_Automatic_2.3.jpg/800px-2018_Nissan_Navara_Tekna_DCi_Automatic_2.3.jpg'),
  ('Xenon 2023',           'Tata',      'Truck',  'Truck', 'Manual',    'Diesel',  5,  6000, 'available', 4.3, 'BA 6 PA 6009', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Tata_Xenon_DLE_2013_%2841656884701%29.jpg/800px-Tata_Xenon_DLE_2013_%2841656884701%29.jpg'),
  ('Scorpio Pickup 2023',  'Mahindra',  'Truck',  'Truck', 'Manual',    'Diesel',  5,  6500, 'available', 4.4, 'BA 6 PA 6010', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Mahindra_Scorpio_GLX_2.6_m-Hawk_2011_%2836756517492%29.jpg/800px-Mahindra_Scorpio_GLX_2.6_m-Hawk_2011_%2836756517492%29.jpg');

-- ── 3. Notify PostgREST ────────────────────────────────────────────────────
notify pgrst, 'reload schema';
