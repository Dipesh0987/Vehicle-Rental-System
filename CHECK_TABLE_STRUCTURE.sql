-- ============================================================
-- Check Your Vehicle Table Structure
-- Run this to see what columns you actually have
-- ============================================================

-- Method 1: Show all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles'
ORDER BY ordinal_position;

-- Method 2: Show sample data
SELECT * FROM vehicles LIMIT 1;

-- Method 3: Describe table (PostgreSQL)
\d vehicles
