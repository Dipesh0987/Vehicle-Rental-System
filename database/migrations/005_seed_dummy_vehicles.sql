-- 005_seed_dummy_vehicles.sql
-- Purpose: Seed a shared vehicle catalog so records appear in both admin panel and public website.

do $$
begin
  if to_regclass('public.vehicles') is null or to_regclass('public.vehicle_images') is null then
    raise exception 'Missing vehicle catalog tables. Run database/migrations/009_vehicle_catalog_repair.sql (or run 004 first).';
  end if;
end
$$;

insert into public.vehicles (
  id,
  name,
  type,
  seats,
  price_per_day,
  fuel_type,
  status,
  primary_image_url,
  created_by
)
values
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90001', 'Tesla Model 3', 'Sedan', 5, 110.00, 'Electric', 'available', 'https://picsum.photos/seed/tesla-model-3-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90002', 'Toyota Fortuner', 'SUV', 7, 145.00, 'Diesel', 'available', 'https://picsum.photos/seed/toyota-fortuner-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90003', 'Honda City', 'Sedan', 5, 82.00, 'Petrol', 'available', 'https://picsum.photos/seed/honda-city-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90004', 'Kia Carnival', 'Van', 7, 135.00, 'Diesel', 'available', 'https://picsum.photos/seed/kia-carnival-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90005', 'Hyundai Kona EV', 'SUV', 5, 98.00, 'Electric', 'available', 'https://picsum.photos/seed/hyundai-kona-ev-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90006', 'Nissan Magnite', 'SUV', 5, 76.00, 'Petrol', 'available', 'https://picsum.photos/seed/nissan-magnite-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90007', 'BMW 5 Series', 'Luxury Sedan', 5, 188.00, 'Petrol', 'available', 'https://picsum.photos/seed/bmw-5-series-main/1280/720', null),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90008', 'Mahindra Thar', 'Offroad SUV', 4, 120.00, 'Diesel', 'available', 'https://picsum.photos/seed/mahindra-thar-main/1280/720', null)
on conflict (id) do update
set
  name = excluded.name,
  type = excluded.type,
  seats = excluded.seats,
  price_per_day = excluded.price_per_day,
  fuel_type = excluded.fuel_type,
  status = excluded.status,
  primary_image_url = excluded.primary_image_url;

insert into public.vehicle_images (
  vehicle_id,
  image_url,
  storage_path,
  sort_order
)
values
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90001', 'https://picsum.photos/seed/tesla-model-3-main/1280/720', 'seed/tesla-model-3/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90001', 'https://picsum.photos/seed/tesla-model-3-side/1280/720', 'seed/tesla-model-3/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90001', 'https://picsum.photos/seed/tesla-model-3-interior/1280/720', 'seed/tesla-model-3/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90002', 'https://picsum.photos/seed/toyota-fortuner-main/1280/720', 'seed/toyota-fortuner/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90002', 'https://picsum.photos/seed/toyota-fortuner-side/1280/720', 'seed/toyota-fortuner/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90002', 'https://picsum.photos/seed/toyota-fortuner-interior/1280/720', 'seed/toyota-fortuner/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90003', 'https://picsum.photos/seed/honda-city-main/1280/720', 'seed/honda-city/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90003', 'https://picsum.photos/seed/honda-city-side/1280/720', 'seed/honda-city/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90003', 'https://picsum.photos/seed/honda-city-interior/1280/720', 'seed/honda-city/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90004', 'https://picsum.photos/seed/kia-carnival-main/1280/720', 'seed/kia-carnival/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90004', 'https://picsum.photos/seed/kia-carnival-side/1280/720', 'seed/kia-carnival/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90004', 'https://picsum.photos/seed/kia-carnival-interior/1280/720', 'seed/kia-carnival/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90005', 'https://picsum.photos/seed/hyundai-kona-ev-main/1280/720', 'seed/hyundai-kona-ev/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90005', 'https://picsum.photos/seed/hyundai-kona-ev-side/1280/720', 'seed/hyundai-kona-ev/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90005', 'https://picsum.photos/seed/hyundai-kona-ev-interior/1280/720', 'seed/hyundai-kona-ev/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90006', 'https://picsum.photos/seed/nissan-magnite-main/1280/720', 'seed/nissan-magnite/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90006', 'https://picsum.photos/seed/nissan-magnite-side/1280/720', 'seed/nissan-magnite/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90006', 'https://picsum.photos/seed/nissan-magnite-interior/1280/720', 'seed/nissan-magnite/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90007', 'https://picsum.photos/seed/bmw-5-series-main/1280/720', 'seed/bmw-5-series/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90007', 'https://picsum.photos/seed/bmw-5-series-side/1280/720', 'seed/bmw-5-series/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90007', 'https://picsum.photos/seed/bmw-5-series-interior/1280/720', 'seed/bmw-5-series/03-interior.jpg', 2),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90008', 'https://picsum.photos/seed/mahindra-thar-main/1280/720', 'seed/mahindra-thar/01-main.jpg', 0),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90008', 'https://picsum.photos/seed/mahindra-thar-side/1280/720', 'seed/mahindra-thar/02-side.jpg', 1),
  ('7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90008', 'https://picsum.photos/seed/mahindra-thar-interior/1280/720', 'seed/mahindra-thar/03-interior.jpg', 2)
on conflict (vehicle_id, sort_order) do update
set
  image_url = excluded.image_url,
  storage_path = excluded.storage_path;

-- Keep primary image URL in sync with sort_order = 0 image row.
update public.vehicles as vehicle
set primary_image_url = image.image_url
from public.vehicle_images as image
where image.vehicle_id = vehicle.id
  and image.sort_order = 0
  and vehicle.id in (
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90001',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90002',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90003',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90004',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90005',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90006',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90007',
    '7f4dcf10-2f8a-4a0f-9cf7-18f4d5f90008'
  );
