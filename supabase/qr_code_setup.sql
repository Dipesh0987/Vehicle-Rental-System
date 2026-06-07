-- ============================================================================
-- QR CODE MANAGEMENT SETUP
-- ============================================================================

-- Ensure billing_settings table exists (for storing QR code URL)
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     text UNIQUE NOT NULL,
  setting_value   text,
  description     text,
  updated_at      timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read billing_settings" ON public.billing_settings;
DROP POLICY IF EXISTS "Allow admin manage billing_settings" ON public.billing_settings;
DROP POLICY IF EXISTS "Allow anon read QR setting" ON public.billing_settings;
DROP POLICY IF EXISTS "Allow all authenticated manage billing_settings" ON public.billing_settings;

-- Allow all authenticated users to read settings
CREATE POLICY "Allow authenticated read billing_settings"
  ON public.billing_settings FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert/update/delete settings
CREATE POLICY "Allow authenticated manage billing_settings"
  ON public.billing_settings FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to read specific settings (for QR code display on payment page)
CREATE POLICY "Allow anon read QR setting"
  ON public.billing_settings FOR SELECT TO anon
  USING (setting_key = 'payment_qr_image');

-- Grant permissions
GRANT SELECT ON public.billing_settings TO anon;
GRANT SELECT ON public.billing_settings TO authenticated;
GRANT ALL ON public.billing_settings TO authenticated;

-- ============================================================================
-- STORAGE BUCKET SETUP (run in Supabase dashboard or via API)
-- ============================================================================
-- Note: Create 'payment-assets' bucket with public access for QR code images
-- 
-- Go to Supabase Dashboard → Storage → New Bucket:
-- Bucket name: payment-assets
-- Public: true (checked)
-- 
-- Then set bucket policies to allow uploads:
-- INSERT policy: auth.role() = 'authenticated'
-- SELECT policy: true (public read)
-- DELETE policy: auth.role() = 'authenticated'

-- ============================================================================
-- SAMPLE INSERT (optional - for testing)
-- ============================================================================
-- INSERT INTO public.billing_settings (setting_key, setting_value, description)
-- VALUES ('payment_qr_image', '', 'URL to payment QR code image')
-- ON CONFLICT (setting_key) DO NOTHING;
