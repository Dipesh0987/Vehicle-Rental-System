-- Migration 016: Update foreign key constraints to RESTRICT
-- Purpose: Change user_id foreign key from CASCADE to RESTRICT as per DBA requirements
-- Status: Up (UpdateForeignKeyConstraints)

-- Drop existing foreign key constraint on user_id
ALTER TABLE public.bookings DROP CONSTRAINT fk_user;

-- Add new foreign key constraint with RESTRICT
ALTER TABLE public.bookings ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Note: vehicle_id foreign key already uses RESTRICT, so no change needed

-- Rollback guidance:
-- ALTER TABLE public.bookings DROP CONSTRAINT fk_user;
-- ALTER TABLE public.bookings ADD CONSTRAINT fk_user
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;