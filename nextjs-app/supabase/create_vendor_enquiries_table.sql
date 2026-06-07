-- Create vendor_enquiries table for vendor registration/enquiry system
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS vendor_enquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  fleet_count INTEGER NOT NULL DEFAULT 1,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('self_drive', 'with_driver', 'both')),
  price_min DECIMAL(10, 2) NOT NULL,
  price_max DECIMAL(10, 2) NOT NULL,
  description TEXT,
  car_images TEXT[] DEFAULT '{}',
  terms_accepted BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vendor_enquiries_status ON vendor_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_vendor_enquiries_created_at ON vendor_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_enquiries_email ON vendor_enquiries(email);

-- Enable RLS
ALTER TABLE vendor_enquiries ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert (for public form submission)
CREATE POLICY "Allow public insert" ON vendor_enquiries
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Allow authenticated admins to view all
CREATE POLICY "Allow admins to view all" ON vendor_enquiries
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated admins to update
CREATE POLICY "Allow admins to update" ON vendor_enquiries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for vendor car images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-images', 'vendor-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow public uploads (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public uploads vendor' AND tablename = 'objects') THEN
    CREATE POLICY "Allow public uploads vendor" ON storage.objects
      FOR INSERT TO public WITH CHECK (bucket_id = 'vendor-images');
  END IF;
END $$;

-- Storage policy: Allow public reads (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public reads vendor' AND tablename = 'objects') THEN
    CREATE POLICY "Allow public reads vendor" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'vendor-images');
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendor_enquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_vendor_enquiries_updated_at ON vendor_enquiries;
CREATE TRIGGER trigger_vendor_enquiries_updated_at
  BEFORE UPDATE ON vendor_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_enquiries_updated_at();

-- Add notification when vendor enquiry is submitted
CREATE OR REPLACE FUNCTION notify_vendor_enquiry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    is_admin,
    type,
    title,
    body,
    link_url,
    metadata
  ) VALUES (
    NULL,
    true,
    'vendor_enquiry',
    'New Vendor Enquiry from ' || NEW.full_name,
    NEW.business_name || ' - ' || NEW.city || ' (' || NEW.fleet_count || ' cars)',
    '/admin/vendor-enquiries',
    jsonb_build_object(
      'enquiry_id', NEW.id,
      'business_name', NEW.business_name,
      'email', NEW.email,
      'phone', NEW.phone
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_vendor_enquiry ON vendor_enquiries;
CREATE TRIGGER trigger_notify_vendor_enquiry
  AFTER INSERT ON vendor_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION notify_vendor_enquiry();

SELECT 'Vendor enquiries table created successfully!' AS result;
