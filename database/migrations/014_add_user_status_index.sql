-- Migration 014: Add composite index for customer dashboard
-- Purpose: Add composite index on (user_id, status) for efficient customer dashboard queries
-- Status: Up (AddUserStatusIndex)

-- Add composite index for customer dashboard performance
CREATE INDEX idx_bookings_user_status ON public.bookings(user_id, status);

-- Rollback guidance:
-- DROP INDEX IF EXISTS idx_bookings_user_status;