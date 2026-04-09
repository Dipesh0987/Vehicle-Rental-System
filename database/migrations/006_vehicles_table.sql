-- Migration 006: Create vehicles table
-- Purpose: Store vehicle fleet information and pricing
-- Status: Up (CreateTableVehicles)

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model_year SMALLINT,
  
  -- Vehicle specifications
  category VARCHAR(50) NOT NULL CHECK (category IN ('sedan', 'suv', 'truck', 'van', 'luxury', 'electric')),
  transmission VARCHAR(20) DEFAULT 'automatic',
  fuel_type VARCHAR(20) DEFAULT 'gasoline',
  color VARCHAR(50),
  license_plate VARCHAR(20) UNIQUE,
  vin VARCHAR(17) UNIQUE,
  
  -- Capacity
  seats SMALLINT DEFAULT 5,
  trunk_capacity_liters SMALLINT,
  
  -- Pricing
  daily_rate DECIMAL(10,2) NOT NULL,
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  
  -- Features and services
  features JSONB DEFAULT '[]', -- e.g., ["GPS", "Bluetooth", "Sunroof"]
  available_addons JSONB DEFAULT '[]', -- e.g., ["Child Seat", "WiFi", "Insurance"]
  
  -- Status and availability
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  is_available BOOLEAN DEFAULT TRUE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  current_mileage INTEGER DEFAULT 0,
  
  -- Images and documentation
  image_url VARCHAR(500),
  image_urls JSONB DEFAULT '[]', -- Multiple images
  registration_expiry DATE,
  insurance_expiry DATE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_daily_rate CHECK (daily_rate > 0)
);

-- Create indexes for common queries
CREATE INDEX idx_vehicles_brand ON public.vehicles(brand);
CREATE INDEX idx_vehicles_category ON public.vehicles(category);
CREATE INDEX idx_vehicles_is_available ON public.vehicles(is_available);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_daily_rate ON public.vehicles(daily_rate);

-- Set up RLS policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view available vehicles
CREATE POLICY "Anyone can view available vehicles" ON public.vehicles
  FOR SELECT USING (is_available = TRUE OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Only admins can insert, update, delete vehicles
CREATE POLICY "Only admins can manage vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can update vehicles" ON public.vehicles
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can delete vehicles" ON public.vehicles
  FOR DELETE USING (auth.jwt() ->> 'role' = 'admin');

-- Create sample vehicles for testing
INSERT INTO public.vehicles (brand, name, category, daily_rate, seats, features, is_available, status)
VALUES
  ('Toyota', 'Camry Hybrid', 'sedan', 50.00, 5, '["GPS", "Bluetooth", "Backup Camera"]'::jsonb, TRUE, 'active'),
  ('Honda', 'CR-V Touring', 'suv', 65.00, 7, '["AWD", "GPS", "Leather Seats", "Sunroof"]'::jsonb, TRUE, 'active'),
  ('Tesla', 'Model 3', 'electric', 75.00, 5, '["Autopilot", "GPS", "Premium Audio"]'::jsonb, TRUE, 'active'),
  ('Ford', 'F-150 Truck', 'truck', 85.00, 5, '["4WD", "Towing Package", "Bluetooth"]'::jsonb, TRUE, 'active'),
  ('Mercedes', 'E-Class', 'luxury', 150.00, 5, '["Premium Audio", "Leather", "Heated Seats", "Panorama Roof"]'::jsonb, TRUE, 'active'),
  ('Toyota', 'Sienna Van', 'van', 70.00, 8, '["Backup Camera", "Bluetooth", "Climate Control"]'::jsonb, TRUE, 'active')
ON CONFLICT DO NOTHING;

-- Rollback guidance:
-- DROP TABLE public.vehicles;
