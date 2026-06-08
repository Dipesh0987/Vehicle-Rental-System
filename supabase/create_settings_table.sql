-- Create settings table for dynamic admin configurations
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  type VARCHAR(20) DEFAULT 'text', -- text, json, html, number
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read for non-sensitive settings
CREATE POLICY "Allow public read" ON app_settings
  FOR SELECT
  TO public
  USING (true);

-- Policy: Allow authenticated admins to update
CREATE POLICY "Allow admins to update" ON app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow admins to insert
CREATE POLICY "Allow admins to insert" ON app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default Terms & Conditions
INSERT INTO app_settings (key, value, type, description) VALUES
('terms_and_conditions', '1. Valid driving license required for self-drive rentals.
2. Vehicle is for personal use only. Commercial, public or rental use prohibited.
3. No illegal activities, off-road driving, or racing allowed.
4. Renter is liable for all traffic fines and violations.
5. Renter responsible for damages due to negligence or reckless driving.
6. In case of breakdown or accident, inform company immediately.
7. Damages not covered by insurance must be paid by renter.
8. In case of damage or accident, rental charges apply for repair.
9. If renter fails to pay dues, company may recover via security cheque.
10. If renter is unreachable after accident, company may use security cheque.
11. Extension/cancellation must be informed 24 hrs prior. Late penalty: NPR 500/hour.
12. NPR 1,000 cleaning fee applies for excessively dirty vehicle.
13. Advance payment confirms booking. Cancellation charges apply.
14. Vehicle must be returned with same fuel level; otherwise charges apply.
15. Vehicle must be returned by 7:00 PM. Late fee: NPR 800/hour.
16. Next day processing at 7:00 AM.', 'text', 'Terms and Conditions displayed on the website')
ON CONFLICT (key) DO NOTHING;

-- Insert company info settings
INSERT INTO app_settings (key, value, type, description) VALUES
('company_name', 'ASSelf', 'text', 'Company name displayed on website'),
('company_phone', '+977 970-452-0781', 'text', 'Contact phone number'),
('company_email', 'info@asselfdrive.com', 'text', 'Contact email address'),
('company_address', 'Banasthali, Kathmandu, Nepal', 'text', 'Company address'),
('whatsapp_number', '9779704520781', 'text', 'WhatsApp contact number')
ON CONFLICT (key) DO NOTHING;

SELECT 'Settings table created successfully!' AS result;
