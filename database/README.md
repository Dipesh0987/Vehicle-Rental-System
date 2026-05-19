# Database Migrations

All schema changes are managed as ordered SQL migration files in `migrations/`.
Run them sequentially in the Supabase SQL Editor.

## Migration Order

| # | File | Purpose |
|---|---|---|
| 001 | `001_user_profiles.sql` | User profiles table |
| 002 | `002_user_profiles_avatar.sql` | Avatar URL column |
| 003 | `003_profile_images_storage.sql` | Profile image storage bucket + RLS |
| 004 | `004_vehicle_catalog_and_images.sql` | Vehicle catalog, images, storage |
| 005 | `005_vehicle_catalog_schema_hotfix.sql` | Schema backfill for legacy columns |
| 006 | `006_vehicle_bookings_system.sql` | Bookings table + double-booking prevention |
| 007 | `007_booking_code_four_digits.sql` | Booking code format |
| 008 | `008_admin_booking_status_updates.sql` | Admin booking status write policies |
| 009 | `009_booking_driver_option.sql` | Driver option column |
| 010 | `010_vehicle_number_support.sql` | Vehicle number plate support |
| 011 | `011_booking_currency_npr.sql` | NPR currency default |
| 012 | `012_user_profile_verification_workflow.sql` | Customer KYC workflow |
| 013 | `013_verification_document_image_url.sql` | KYC document image URL |
| 014 | `014_admin_profile_access_fallback_and_listing_rpc.sql` | Admin profile listing RPC |
| 015a | `015_booking_payment_and_admin_write_policies.sql` | Payment write policies |
| 015b | `015_password_reset_otp_flow.sql` | Custom OTP password reset |
| 016 | `016_migrate_legacy_bookings_to_vehicle_bookings.sql` | Legacy data migration |
| 017 | `017_booking_cancellation_request_rpc.sql` | Cancellation request RPC |
| 018 | `018_discount_codes.sql` | Coupon/promo code system |
| 021 | `021_live_fleet_tracking.sql` | Live fleet GPS tracking table |
| 022 | `022_seed_live_fleet_sample_locations.sql` | Sample fleet location seed data |
| 023a | `023_drivers_table.sql` | Drivers management table |
| 023b | `023_khalti_payment_integration.sql` | Payments table + DB trigger for booking sync |
| 024a | `024_extra_notifications.sql` | Extended notification types |
| 024b | `024_maintenance_table.sql` | Maintenance records table |
| 025 | `025_payments_esewa_provider.sql` | eSewa provider columns on payments |
| 026 | `026_reset_vehicles_seed.sql` | Vehicle catalog seed data |
| 027 | `027_damage_billing.sql` | Damage billing table + RLS |
| 028 | `028_maintenance_customer_link.sql` | Maintenance to customer link |
| 029 | `029_maintenance_realtime_billed.sql` | Maintenance real-time billed flag |
| 030 | `030_migrate_khalti_to_esewa.sql` | Provider migration helper |
| 031 | `031_add_brand_logo_url_to_vehicles.sql` | Brand logo URL on vehicles |
| 032 | `032_contact_messages.sql` | Contact form submissions table |
| 033 | `033_rls_admin_role_enforcement.sql` | Admin-role RLS on all admin tables + indexes |

## Notes

- Migrations are **append-only** — never edit a previously applied migration.
- Each file is idempotent (`CREATE IF NOT EXISTS`, `DROP POLICY IF EXISTS`) and safe to re-run.
- Migration `033` must be run after `004` (requires `admin_users` table).
