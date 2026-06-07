-- Verify vehicle connection in booking table
-- Run this in Supabase SQL Editor

-- 1. Check if vehicle_id foreign key exists on vehicle_bookings
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'vehicle_bookings';

-- 2. Check if vehicle_id column exists and has data
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicle_bookings' 
AND column_name IN ('vehicle_id', 'id');

-- 3. Test a sample booking with vehicle join
SELECT 
    vb.id as booking_id,
    vb.vehicle_id,
    v.id as vehicle_exists,
    v.name as vehicle_name,
    v.vehicle_number
FROM vehicle_bookings vb
LEFT JOIN vehicles v ON vb.vehicle_id = v.id
LIMIT 5;
