-- Migration 004: Create bookings table
-- Purpose: Store rental booking information
-- Status: Up (CreateTableBookings)

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  booking_reference VARCHAR(20) NOT NULL UNIQUE,
  
  -- Booking dates and times
  pickup_date DATE NOT NULL,
  pickup_time TIME DEFAULT '10:00:00',
  dropoff_date DATE NOT NULL,
  dropoff_time TIME DEFAULT '09:30:00',
  
  -- Locations
  pickup_location VARCHAR(255) NOT NULL,
  dropoff_location VARCHAR(255) NOT NULL,
  
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  total_price DECIMAL(10,2) NOT NULL,
  
  -- Status and details
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
  driver_name VARCHAR(255),
  payment_method VARCHAR(100),
  additional_drivers VARCHAR(500),
  insurance_type VARCHAR(50),
  
  -- Addons (JSON array)
  add_ons JSONB DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT
);

-- Add indexes for common queries
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_pickup_date ON public.bookings(pickup_date);
CREATE INDEX idx_bookings_created_at ON public.bookings(created_at DESC);

-- Set up RLS policies
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view only their own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can insert their own bookings
CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bookings
CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Rollback guidance:
-- DROP TABLE public.bookings;
