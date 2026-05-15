-- Migration 017: Create refund tracking table
-- Purpose: Track refund status for cancelled bookings
-- Status: Up (CreateRefundTrackingTable)

-- ===== Refund Tracking Table =====
-- Stores refund information for cancelled bookings
CREATE TABLE IF NOT EXISTS public.refund_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE,
  
  -- Refund details
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_method VARCHAR(50) NOT NULL CHECK (refund_method IN ('credit_card', 'bank_transfer', 'wallet', 'original_payment')),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'credited', 'failed')),
  failure_reason TEXT,
  
  -- Dates
  cancellation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  refund_initiated_at TIMESTAMP WITH TIME ZONE,
  refund_credited_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  last_status_check TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  payment_reference VARCHAR(255),
  bank_transaction_id VARCHAR(255),
  notification_sent BOOLEAN DEFAULT FALSE,
  support_ticket_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

-- Add indexes for efficient querying
CREATE INDEX idx_refund_status ON public.refund_tracking(status);
CREATE INDEX idx_refund_user_cancellation ON public.refund_tracking(cancellation_date DESC);
CREATE INDEX idx_refund_booking_id ON public.refund_tracking(booking_id);

-- Set up RLS policies
ALTER TABLE public.refund_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view refund status for their own cancelled bookings
CREATE POLICY "Users can view own refund status" ON public.refund_tracking
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings 
      WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Admin can update refund status
CREATE POLICY "Admin can update refund status" ON public.refund_tracking
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Function to update refund status
CREATE OR REPLACE FUNCTION update_refund_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamp
CREATE TRIGGER refund_tracking_update_timestamp
BEFORE UPDATE ON public.refund_tracking
FOR EACH ROW
EXECUTE FUNCTION update_refund_status_timestamp();

-- Rollback guidance:
-- DROP TRIGGER refund_tracking_update_timestamp ON public.refund_tracking;
-- DROP FUNCTION update_refund_status_timestamp();
-- DROP TABLE public.refund_tracking;
