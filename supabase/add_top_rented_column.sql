-- Add is_top_rented column to vehicles table
-- Admin can mark vehicles as "Top Rented" to show on homepage
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_top_rented BOOLEAN DEFAULT false;
