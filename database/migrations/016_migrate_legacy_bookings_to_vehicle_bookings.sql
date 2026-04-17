-- 016_migrate_legacy_bookings_to_vehicle_bookings.sql
-- Purpose: One-time backfill from legacy public.bookings into canonical public.vehicle_bookings.
-- Notes:
-- - Idempotent: skips rows already migrated by booking_code.
-- - Maps legacy status 'active' -> 'confirmed'.
-- - Uses user_profiles when available to backfill customer identity fields.

do $$
begin
  if to_regclass('public.bookings') is null then
    raise notice 'Skipping legacy booking backfill: table public.bookings does not exist.';
  else
    insert into public.vehicle_bookings (
      id,
      booking_code,
      vehicle_id,
      customer_user_id,
      customer_name,
      customer_email,
      customer_phone,
      start_date,
      end_date,
      pickup_time,
      driver_option,
      status,
      currency,
      base_amount,
      service_fee,
      tax_amount,
      discount_amount,
      total_amount,
      coupon_code,
      notes,
      created_at,
      updated_at
    )
    select
      b.id,
      b.booking_reference,
      b.vehicle_id,
      b.user_id,
      coalesce(nullif(trim(up.full_name), ''), 'Customer') as customer_name,
      coalesce(nullif(trim(up.email), ''), 'unknown@vehicle-rental.local') as customer_email,
      '' as customer_phone,
      b.pickup_date as start_date,
      b.dropoff_date as end_date,
      coalesce(b.pickup_time, time '10:00') as pickup_time,
      case
        when coalesce(nullif(trim(b.driver_name), ''), '') <> '' then 'with_driver'
        else 'self_drive'
      end as driver_option,
      case
        when lower(trim(b.status)) = 'active' then 'confirmed'
        when lower(trim(b.status)) in ('pending', 'confirmed', 'cancelled', 'completed') then lower(trim(b.status))
        else 'pending'
      end as status,
      case
        when nullif(trim(b.currency), '') is null then 'NPR'
        else upper(trim(b.currency))
      end as currency,
      coalesce(b.base_price, 0) as base_amount,
      coalesce(b.service_fee, 0) as service_fee,
      coalesce(b.tax_amount, 0) as tax_amount,
      coalesce(b.discount_amount, 0) as discount_amount,
      coalesce(b.total_price, 0) as total_amount,
      null as coupon_code,
      concat_ws(' | ',
        nullif(trim(b.pickup_location), ''),
        nullif(trim(b.dropoff_location), ''),
        case
          when b.insurance_type is null or nullif(trim(b.insurance_type), '') is null then null
          else 'Insurance: ' || trim(b.insurance_type)
        end
      ) as notes,
      coalesce(b.created_at, now()) as created_at,
      coalesce(b.updated_at, b.created_at, now()) as updated_at
    from public.bookings b
    left join public.user_profiles up
      on up.id = b.user_id
    where not exists (
      select 1
      from public.vehicle_bookings vb
      where vb.booking_code = b.booking_reference
    )
    on conflict (booking_code) do nothing;
  end if;
end;
$$;

notify pgrst, 'reload schema';
