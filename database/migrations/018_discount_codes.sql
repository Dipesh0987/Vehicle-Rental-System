-- Create discount_codes table for promo code management
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9_-]{3,20}$'),
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
  current_uses INT DEFAULT 0 CHECK (current_uses >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  min_booking_amount NUMERIC CHECK (min_booking_amount IS NULL OR min_booking_amount >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (valid_from < valid_until),
  CONSTRAINT usage_limit CHECK (current_uses <= COALESCE(max_uses, current_uses + 1))
);

-- Add indexes for performance
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_is_active ON public.discount_codes(is_active);
CREATE INDEX idx_discount_codes_created_by ON public.discount_codes(created_by);

-- Enable RLS on discount_codes table
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin users (in admin_users table) can manage their own codes
CREATE POLICY discount_codes_admin_access ON public.discount_codes
  FOR ALL
  USING (
    auth.uid() = created_by 
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by 
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- RLS Policy: Authenticated users can view active codes
CREATE POLICY discount_codes_user_view ON public.discount_codes
  FOR SELECT
  USING (is_active = TRUE AND auth.role() = 'authenticated');

-- Function to validate discount code
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT,
  p_booking_amount NUMERIC
) RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount NUMERIC,
  error_message TEXT,
  discount_type TEXT,
  discount_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN dc.id IS NULL THEN FALSE
      WHEN dc.is_active = FALSE THEN FALSE
      WHEN NOW() < dc.valid_from OR NOW() > dc.valid_until THEN FALSE
      WHEN dc.max_uses IS NOT NULL AND dc.current_uses >= dc.max_uses THEN FALSE
      WHEN dc.min_booking_amount IS NOT NULL AND p_booking_amount < dc.min_booking_amount THEN FALSE
      ELSE TRUE
    END AS is_valid,
    CASE 
      WHEN dc.id IS NULL THEN 0
      WHEN dc.is_active = FALSE THEN 0
      WHEN NOW() < dc.valid_from OR NOW() > dc.valid_until THEN 0
      WHEN dc.max_uses IS NOT NULL AND dc.current_uses >= dc.max_uses THEN 0
      WHEN dc.min_booking_amount IS NOT NULL AND p_booking_amount < dc.min_booking_amount THEN 0
      WHEN dc.discount_type = 'percentage' THEN LEAST((p_booking_amount * dc.discount_value / 100), p_booking_amount)
      ELSE dc.discount_value
    END AS discount_amount,
    CASE 
      WHEN dc.id IS NULL THEN 'This code is not valid for your booking'
      WHEN dc.is_active = FALSE THEN 'This code is not valid for your booking'
      WHEN NOW() < dc.valid_from THEN 'This code is not valid yet'
      WHEN NOW() > dc.valid_until THEN 'This code has expired'
      WHEN dc.max_uses IS NOT NULL AND dc.current_uses >= dc.max_uses THEN 'This code has reached its usage limit'
      WHEN dc.min_booking_amount IS NOT NULL AND p_booking_amount < dc.min_booking_amount THEN 'This code requires a minimum booking amount of NPR ' || dc.min_booking_amount
      ELSE NULL
    END AS error_message,
    dc.discount_type,
    dc.discount_value
  FROM public.discount_codes dc
  WHERE UPPER(dc.code) = UPPER(p_code);
END;
$$ LANGUAGE plpgsql;

-- Function to apply discount code (increment usage)
CREATE OR REPLACE FUNCTION public.apply_discount_code(p_code TEXT)
RETURNS TABLE (success BOOLEAN, error_message TEXT) AS $$
BEGIN
  UPDATE public.discount_codes
  SET current_uses = current_uses + 1
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = TRUE
    AND NOW() >= valid_from
    AND NOW() <= valid_until
    AND (max_uses IS NULL OR current_uses < max_uses);

  IF FOUND THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Could not apply discount code'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;
