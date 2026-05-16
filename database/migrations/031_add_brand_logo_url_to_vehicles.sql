-- 031_add_brand_logo_url_to_vehicles.sql
-- Purpose: Add a dedicated brand logo URL to the vehicles table and backfill

alter table public.vehicles
  add column if not exists brand_logo_url text;

-- Backfill brand_logo_url from primary_image_url only when brand_logo_url is empty
update public.vehicles
set brand_logo_url = primary_image_url
where (brand_logo_url is null or trim(brand_logo_url) = '')
  and (primary_image_url is not null and trim(primary_image_url) <> '');

-- Normalise new column defaults
alter table public.vehicles
  alter column brand_logo_url set default '';

update public.vehicles
set brand_logo_url = coalesce(brand_logo_url, '')
where brand_logo_url is null;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
