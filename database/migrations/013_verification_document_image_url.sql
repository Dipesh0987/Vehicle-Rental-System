-- 013_verification_document_image_url.sql
-- Purpose: Store uploaded KYC document image URL for user/admin preview workflows.

alter table if exists public.user_profiles
  add column if not exists document_image_url text;

comment on column public.user_profiles.document_image_url is
  'Public URL (or approved data URL fallback) of uploaded identity document image for KYC review.';

notify pgrst, 'reload schema';
