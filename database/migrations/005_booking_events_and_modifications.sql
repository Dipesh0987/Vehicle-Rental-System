-- Migration 005: Create booking_events and booking_modifications tables
-- Purpose: Audit trail for booking lifecycle and modifications
-- Status: Up (CreateBookingEventsTable)

-- ===== Booking Events Table =====
-- Tracks all status transitions in booking lifecycle
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'confirmed', 'modified', 'activated', 'completed', 'cancelled')),
  
  -- Event metadata
  event_data JSONB DEFAULT '{}',
  description TEXT,
  performed_by UUID NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_booking_events_booking_id ON public.booking_events(booking_id);
CREATE INDEX idx_booking_events_created_at ON public.booking_events(created_at DESC);

-- ===== Booking Modifications Table =====
-- Tracks detailed modification history with before/after states
CREATE TABLE IF NOT EXISTS public.booking_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  booking_event_id UUID NOT NULL,
  
  -- Original values
  original_pickup_date DATE,
  original_dropoff_date DATE,
  original_vehicle_id UUID,
  original_pickup_location VARCHAR(255),
  original_dropoff_location VARCHAR(255),
  original_total_price DECIMAL(10,2),
  
  -- New values
  new_pickup_date DATE NOT NULL,
  new_dropoff_date DATE NOT NULL,
  new_vehicle_id UUID NOT NULL,
  new_pickup_location VARCHAR(255) NOT NULL,
  new_dropoff_location VARCHAR(255) NOT NULL,
  new_total_price DECIMAL(10,2) NOT NULL,
  
  -- Price adjustments
  price_difference DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_refund BOOLEAN DEFAULT FALSE, -- TRUE if customer gets money back
  is_charge BOOLEAN DEFAULT FALSE, -- TRUE if customer needs to pay more
  
  -- Modification metadata
  reason VARCHAR(255),
  modified_by UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_event FOREIGN KEY (booking_event_id) REFERENCES public.booking_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_modified_by FOREIGN KEY (modified_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_new_vehicle FOREIGN KEY (new_vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_modifications_booking_id ON public.booking_modifications(booking_id);
CREATE INDEX idx_modifications_created_at ON public.booking_modifications(created_at DESC);
CREATE INDEX idx_modifications_status ON public.booking_modifications(status);

-- Enable RLS
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_modifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_events
CREATE POLICY "Users can view own booking events" ON public.booking_events
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bookings WHERE id = booking_id AND user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for booking_modifications
CREATE POLICY "Users can view own booking modifications" ON public.booking_modifications
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bookings WHERE id = booking_id AND user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Rollback guidance:
-- DROP TABLE public.booking_modifications;
-- DROP TABLE public.booking_events;
