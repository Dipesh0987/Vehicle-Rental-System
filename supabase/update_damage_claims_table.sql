-- Update damage_claims table for cleaner workflow
-- Run this in Supabase SQL Editor

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS damage_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_number TEXT UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    damage_description TEXT NOT NULL,
    damage_location TEXT,
    total_damage_cost DECIMAL(10,2) DEFAULT 0,
    damage_date DATE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Sent to Customer', 'Paid', 'Disputed', 'Waived', 'Closed')),
    admin_notes TEXT,
    customer_response TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (safe to run multiple times)
DO $$ 
BEGIN
    -- Add customer_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'customer_name') THEN
        ALTER TABLE damage_claims ADD COLUMN customer_name TEXT;
    END IF;

    -- Add customer_email if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'customer_email') THEN
        ALTER TABLE damage_claims ADD COLUMN customer_email TEXT;
    END IF;

    -- Add customer_phone if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'customer_phone') THEN
        ALTER TABLE damage_claims ADD COLUMN customer_phone TEXT;
    END IF;

    -- Add damage_location if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'damage_location') THEN
        ALTER TABLE damage_claims ADD COLUMN damage_location TEXT;
    END IF;
    
    -- Add damage_date if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'damage_date') THEN
        ALTER TABLE damage_claims ADD COLUMN damage_date DATE;
    END IF;
    
    -- Add resolved_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'resolved_at') THEN
        ALTER TABLE damage_claims ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;
    
    -- Add customer_response if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_claims' AND column_name = 'customer_response') THEN
        ALTER TABLE damage_claims ADD COLUMN customer_response TEXT;
    END IF;
END $$;

-- Update old status values to new ones (if any exist with old naming)
UPDATE damage_claims SET status = 'Pending' WHERE status = 'pending';
UPDATE damage_claims SET status = 'Under Review' WHERE status = 'reviewed';
UPDATE damage_claims SET status = 'Sent to Customer' WHERE status = 'sent_to_customer';
UPDATE damage_claims SET status = 'Paid' WHERE status = 'paid';
UPDATE damage_claims SET status = 'Disputed' WHERE status = 'disputed';
UPDATE damage_claims SET status = 'Waived' WHERE status = 'waived';
UPDATE damage_claims SET status = 'Closed' WHERE status = 'closed';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_damage_claims_vehicle ON damage_claims(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_booking ON damage_claims(booking_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_status ON damage_claims(status);
CREATE INDEX IF NOT EXISTS idx_damage_claims_created ON damage_claims(created_at DESC);

-- Enable RLS
ALTER TABLE damage_claims ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first to avoid duplicates)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON damage_claims;
CREATE POLICY "Allow all for authenticated users" ON damage_claims
    FOR ALL USING (true);

-- Update maintenance_records table to add provider_name and odometer_reading if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'provider_name') THEN
        ALTER TABLE maintenance_records ADD COLUMN provider_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'odometer_reading') THEN
        ALTER TABLE maintenance_records ADD COLUMN odometer_reading INTEGER;
    END IF;
END $$;

SELECT 'Damage claims table updated successfully!' as result;
