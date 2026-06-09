-- Add 'status' column to expenses table for tracking maintenance/repair progress
-- Run this in Supabase SQL Editor

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';

-- Update existing maintenance/repair expenses to 'completed' (since they were already recorded)
UPDATE expenses SET status = 'completed' WHERE category IN ('maintenance', 'repair') AND status = 'approved';

-- Add comment for clarity
COMMENT ON COLUMN expenses.status IS 'Status: approved (default for non-maintenance), scheduled, in_progress, completed (for maintenance/repair)';
