-- ============================================================================
-- PROMO CODE UPDATES - Support both Percentage and NPR Amount Discounts
-- ============================================================================

-- Add discount_amount column if not exists
ALTER TABLE public.discount_codes 
ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0;

-- Update discount_type to use 'percent' instead of 'percentage' for consistency
UPDATE public.discount_codes 
SET discount_type = 'percent' 
WHERE discount_type = 'percentage' OR discount_type IS NULL;

-- Update validate_discount_code function to return discount_amount
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code RECORD;
BEGIN
  SELECT * INTO v_code FROM public.discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code not found or expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code.code,
    'discount_percent', v_code.discount_percent,
    'discount_amount', v_code.discount_amount,
    'discount_type', v_code.discount_type,
    'description', v_code.description
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO anon;

-- ============================================================================
-- SAMPLE PROMO CODES (Uncomment to add test codes)
-- ============================================================================

-- Percentage discount example:
-- INSERT INTO public.discount_codes (code, discount_type, discount_percent, discount_amount, valid_from, valid_until, is_active, description) 
-- VALUES ('SAVE10', 'percent', 10, 0, CURRENT_DATE, CURRENT_DATE + 90, true, '10% off your booking')
-- ON CONFLICT (code) DO NOTHING;

-- Fixed NPR amount discount example:
-- INSERT INTO public.discount_codes (code, discount_type, discount_percent, discount_amount, valid_from, valid_until, is_active, description) 
-- VALUES ('FLAT500', 'npr_amount', 0, 500, CURRENT_DATE, CURRENT_DATE + 90, true, 'NPR 500 off your booking')
-- ON CONFLICT (code) DO NOTHING;

-- INSERT INTO public.discount_codes (code, discount_type, discount_percent, discount_amount, valid_from, valid_until, is_active, description) 
-- VALUES ('FLAT1000', 'npr_amount', 0, 1000, CURRENT_DATE, CURRENT_DATE + 90, true, 'NPR 1000 off your booking')
-- ON CONFLICT (code) DO NOTHING;
