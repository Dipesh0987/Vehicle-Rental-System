-- =====================================================
-- VEHICLE INSPECTION & DAMAGE CLAIMS SYSTEM
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Vehicle Parts Master Table (standard parts for all vehicles)
CREATE TABLE IF NOT EXISTS vehicle_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_name TEXT NOT NULL,
  part_category TEXT NOT NULL, -- 'exterior', 'interior', 'mechanical', 'documents'
  default_cost DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vehicle Inspections Table (before/after trip checklists)
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES vehicle_bookings(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('before_trip', 'after_trip')),
  inspector_name TEXT,
  inspector_id UUID REFERENCES user_profiles(id),
  fuel_level TEXT, -- 'full', '3/4', '1/2', '1/4', 'empty'
  odometer_reading DECIMAL(10,1),
  overall_condition TEXT, -- 'excellent', 'good', 'fair', 'poor'
  notes TEXT,
  photos JSONB DEFAULT '[]', -- Array of photo URLs
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, inspection_type)
);

-- 3. Inspection Items (individual part conditions)
CREATE TABLE IF NOT EXISTS inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  part_id UUID REFERENCES vehicle_parts(id),
  part_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('good', 'minor_damage', 'major_damage', 'missing')),
  damage_description TEXT,
  photo_url TEXT,
  repair_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Damage Claims Table
CREATE TABLE IF NOT EXISTS damage_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT UNIQUE,
  booking_id UUID REFERENCES vehicle_bookings(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES user_profiles(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  before_inspection_id UUID REFERENCES vehicle_inspections(id),
  after_inspection_id UUID REFERENCES vehicle_inspections(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'sent_to_customer', 'paid', 'disputed', 'waived', 'closed')),
  total_damage_cost DECIMAL(10,2) DEFAULT 0,
  admin_notes TEXT,
  customer_response TEXT,
  payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 5. Damage Claim Items (individual damaged parts)
CREATE TABLE IF NOT EXISTS damage_claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES damage_claims(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  before_condition TEXT,
  after_condition TEXT,
  damage_description TEXT,
  repair_cost DECIMAL(10,2) DEFAULT 0,
  photo_before TEXT,
  photo_after TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert standard vehicle parts
INSERT INTO vehicle_parts (part_name, part_category, default_cost, sort_order) VALUES
-- Exterior
('Front Bumper', 'exterior', 15000, 1),
('Rear Bumper', 'exterior', 15000, 2),
('Hood/Bonnet', 'exterior', 20000, 3),
('Front Left Fender', 'exterior', 12000, 4),
('Front Right Fender', 'exterior', 12000, 5),
('Rear Left Fender', 'exterior', 12000, 6),
('Rear Right Fender', 'exterior', 12000, 7),
('Front Left Door', 'exterior', 25000, 8),
('Front Right Door', 'exterior', 25000, 9),
('Rear Left Door', 'exterior', 25000, 10),
('Rear Right Door', 'exterior', 25000, 11),
('Trunk/Boot', 'exterior', 18000, 12),
('Roof', 'exterior', 30000, 13),
('Front Windshield', 'exterior', 25000, 14),
('Rear Windshield', 'exterior', 20000, 15),
('Left Side Mirror', 'exterior', 8000, 16),
('Right Side Mirror', 'exterior', 8000, 17),
('Front Left Headlight', 'exterior', 15000, 18),
('Front Right Headlight', 'exterior', 15000, 19),
('Rear Left Taillight', 'exterior', 8000, 20),
('Rear Right Taillight', 'exterior', 8000, 21),
('Front Grille', 'exterior', 10000, 22),
-- Wheels & Tires
('Front Left Wheel/Rim', 'exterior', 12000, 23),
('Front Right Wheel/Rim', 'exterior', 12000, 24),
('Rear Left Wheel/Rim', 'exterior', 12000, 25),
('Rear Right Wheel/Rim', 'exterior', 12000, 26),
('Front Left Tire', 'exterior', 8000, 27),
('Front Right Tire', 'exterior', 8000, 28),
('Rear Left Tire', 'exterior', 8000, 29),
('Rear Right Tire', 'exterior', 8000, 30),
('Spare Tire', 'exterior', 8000, 31),
-- Interior
('Dashboard', 'interior', 20000, 32),
('Steering Wheel', 'interior', 15000, 33),
('Driver Seat', 'interior', 25000, 34),
('Passenger Seat', 'interior', 25000, 35),
('Rear Seats', 'interior', 30000, 36),
('Floor Mats', 'interior', 3000, 37),
('Seat Belts', 'interior', 5000, 38),
('Center Console', 'interior', 10000, 39),
('Infotainment System', 'interior', 35000, 40),
('AC Vents', 'interior', 5000, 41),
('Gear Knob', 'interior', 3000, 42),
('Handbrake', 'interior', 4000, 43),
('Interior Lights', 'interior', 2000, 44),
('Sun Visors', 'interior', 2000, 45),
('Rearview Mirror', 'interior', 3000, 46),
-- Documents & Accessories
('Registration Document', 'documents', 5000, 47),
('Insurance Papers', 'documents', 2000, 48),
('Vehicle Manual', 'documents', 1000, 49),
('First Aid Kit', 'documents', 1500, 50),
('Fire Extinguisher', 'documents', 2000, 51),
('Warning Triangle', 'documents', 500, 52),
('Jack & Tools', 'documents', 5000, 53),
('Car Keys (Spare)', 'documents', 10000, 54)
ON CONFLICT DO NOTHING;

-- Function to generate claim number
CREATE OR REPLACE FUNCTION generate_claim_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.claim_number := 'CLM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto claim number
DROP TRIGGER IF EXISTS set_claim_number ON damage_claims;
CREATE TRIGGER set_claim_number
  BEFORE INSERT ON damage_claims
  FOR EACH ROW
  WHEN (NEW.claim_number IS NULL)
  EXECUTE FUNCTION generate_claim_number();

-- Function to update damage_claims.updated_at
CREATE OR REPLACE FUNCTION update_damage_claim_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_damage_claim_timestamp ON damage_claims;
CREATE TRIGGER update_damage_claim_timestamp
  BEFORE UPDATE ON damage_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_damage_claim_timestamp();

-- Enable RLS
ALTER TABLE vehicle_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_claim_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for authenticated users - adjust as needed)
DROP POLICY IF EXISTS "Allow all for vehicle_parts" ON vehicle_parts;
DROP POLICY IF EXISTS "Allow all for vehicle_inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Allow all for inspection_items" ON inspection_items;
DROP POLICY IF EXISTS "Allow all for damage_claims" ON damage_claims;
DROP POLICY IF EXISTS "Allow all for damage_claim_items" ON damage_claim_items;

CREATE POLICY "Allow all for vehicle_parts" ON vehicle_parts FOR ALL USING (true);
CREATE POLICY "Allow all for vehicle_inspections" ON vehicle_inspections FOR ALL USING (true);
CREATE POLICY "Allow all for inspection_items" ON inspection_items FOR ALL USING (true);
CREATE POLICY "Allow all for damage_claims" ON damage_claims FOR ALL USING (true);
CREATE POLICY "Allow all for damage_claim_items" ON damage_claim_items FOR ALL USING (true);

-- Add inspection_status to vehicle_bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_bookings' AND column_name = 'inspection_status') THEN
    ALTER TABLE vehicle_bookings ADD COLUMN inspection_status TEXT DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'before_done', 'after_done', 'completed'));
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inspections_booking ON vehicle_inspections(booking_id);
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_booking ON damage_claims(booking_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_status ON damage_claims(status);
CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection ON inspection_items(inspection_id);

SELECT 'Vehicle Inspection & Damage Claims tables created successfully!' as result;
