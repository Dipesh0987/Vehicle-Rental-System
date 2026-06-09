-- =====================================================================
-- Vehicle Inspection System Tables
-- Run this in the Supabase SQL Editor.
-- =====================================================================

-- Table for vehicle parts checklist template
CREATE TABLE IF NOT EXISTS public.vehicle_parts (
  id TEXT PRIMARY KEY,
  part_name TEXT NOT NULL,
  part_category TEXT NOT NULL DEFAULT 'exterior',
  default_cost DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for inspection records
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  vehicle_id UUID,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('before_trip', 'after_trip')),
  fuel_level TEXT DEFAULT 'full',
  odometer_reading TEXT,
  overall_condition TEXT DEFAULT 'good',
  notes TEXT,
  inspected_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for individual part conditions per inspection
CREATE TABLE IF NOT EXISTS public.inspection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  part_id TEXT,
  part_name TEXT,
  condition TEXT DEFAULT 'good',
  damage_description TEXT,
  repair_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add inspection_status to bookings if it doesn't exist (may fail if bookings is a view)
-- If this fails, you can skip it - inspection still works without it
DO $$ BEGIN
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS inspection_status TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add inspection_status to bookings (might be a view) - skipping';
END $$;

-- Enable RLS
ALTER TABLE public.vehicle_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users / admins)
DROP POLICY IF EXISTS "Allow all vehicle_parts" ON public.vehicle_parts;
CREATE POLICY "Allow all vehicle_parts" ON public.vehicle_parts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all vehicle_inspections" ON public.vehicle_inspections;
CREATE POLICY "Allow all vehicle_inspections" ON public.vehicle_inspections FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all inspection_items" ON public.inspection_items;
CREATE POLICY "Allow all inspection_items" ON public.inspection_items FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inspections_booking ON public.vehicle_inspections(booking_id);
CREATE INDEX IF NOT EXISTS idx_inspections_type ON public.vehicle_inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspection_items_insp ON public.inspection_items(inspection_id);

-- Seed default parts (only if table is empty)
INSERT INTO public.vehicle_parts (id, part_name, part_category, default_cost, sort_order, is_active)
SELECT * FROM (VALUES
  ('1', 'Front Bumper', 'exterior', 15000, 1, true),
  ('2', 'Rear Bumper', 'exterior', 15000, 2, true),
  ('3', 'Hood/Bonnet', 'exterior', 20000, 3, true),
  ('4', 'Front Left Fender', 'exterior', 12000, 4, true),
  ('5', 'Front Right Fender', 'exterior', 12000, 5, true),
  ('6', 'Front Left Door', 'exterior', 25000, 6, true),
  ('7', 'Front Right Door', 'exterior', 25000, 7, true),
  ('8', 'Rear Left Door', 'exterior', 25000, 8, true),
  ('9', 'Rear Right Door', 'exterior', 25000, 9, true),
  ('10', 'Front Windshield', 'exterior', 25000, 10, true),
  ('11', 'Rear Windshield', 'exterior', 20000, 11, true),
  ('12', 'Left Side Mirror', 'exterior', 8000, 12, true),
  ('13', 'Right Side Mirror', 'exterior', 8000, 13, true),
  ('14', 'Front Left Headlight', 'exterior', 15000, 14, true),
  ('15', 'Front Right Headlight', 'exterior', 15000, 15, true),
  ('16', 'Rear Left Taillight', 'exterior', 8000, 16, true),
  ('17', 'Rear Right Taillight', 'exterior', 8000, 17, true),
  ('18', 'Front Left Wheel/Tire', 'exterior', 12000, 18, true),
  ('19', 'Front Right Wheel/Tire', 'exterior', 12000, 19, true),
  ('20', 'Rear Left Wheel/Tire', 'exterior', 12000, 20, true),
  ('21', 'Rear Right Wheel/Tire', 'exterior', 12000, 21, true),
  ('22', 'Dashboard', 'interior', 20000, 22, true),
  ('23', 'Steering Wheel', 'interior', 15000, 23, true),
  ('24', 'Driver Seat', 'interior', 25000, 24, true),
  ('25', 'Passenger Seat', 'interior', 25000, 25, true),
  ('26', 'Rear Seats', 'interior', 30000, 26, true),
  ('27', 'Floor Mats', 'interior', 3000, 27, true),
  ('28', 'Infotainment System', 'interior', 35000, 28, true),
  ('29', 'AC System', 'interior', 5000, 29, true),
  ('30', 'Rearview Mirror', 'interior', 3000, 30, true),
  ('31', 'Registration Document', 'documents', 5000, 31, true),
  ('32', 'Insurance Papers', 'documents', 2000, 32, true),
  ('33', 'First Aid Kit', 'documents', 1500, 33, true),
  ('34', 'Fire Extinguisher', 'documents', 2000, 34, true),
  ('35', 'Jack & Tools', 'documents', 5000, 35, true),
  ('36', 'Spare Tire', 'documents', 8000, 36, true)
) AS v(id, part_name, part_category, default_cost, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_parts LIMIT 1);

SELECT 'Vehicle inspection tables created and seeded!' AS result;
