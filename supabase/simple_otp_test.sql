-- ============================================
-- SIMPLE OTP TEST (Without SMS sending)
-- Use this to test if basic OTP generation works
-- ============================================

-- Drop existing functions
DROP FUNCTION IF EXISTS generate_and_send_otp(TEXT);
DROP FUNCTION IF EXISTS verify_otp_and_login(TEXT, TEXT);

-- ============================================
-- SIMPLE VERSION: Just generate OTP (no SMS)
-- ============================================

CREATE OR REPLACE FUNCTION generate_and_send_otp(p_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  v_otp TEXT;
  v_formatted_phone TEXT;
BEGIN
  -- Format phone number
  v_formatted_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  
  -- Add 977 if needed
  IF LENGTH(v_formatted_phone) = 10 AND LEFT(v_formatted_phone, 1) = '9' THEN
    v_formatted_phone := '977' || v_formatted_phone;
  ELSIF LEFT(v_formatted_phone, 1) = '0' AND LENGTH(v_formatted_phone) = 11 THEN
    v_formatted_phone := '977' || SUBSTRING(v_formatted_phone, 2);
  END IF;
  
  -- Validate Nepal phone number
  IF v_formatted_phone !~ '^977(98|97)[0-9]{8}$' THEN
    RAISE EXCEPTION 'Invalid Nepal phone number format';
  END IF;
  
  -- Generate 4-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  -- Store OTP in database
  INSERT INTO otp_codes (phone, otp, expires_at, created_at)
  VALUES (v_formatted_phone, v_otp, NOW() + INTERVAL '5 minutes', NOW())
  ON CONFLICT (phone) 
  DO UPDATE SET 
    otp = v_otp,
    expires_at = NOW() + INTERVAL '5 minutes',
    created_at = NOW();
  
  -- Log for development
  RAISE NOTICE 'OTP generated for %: %', v_formatted_phone, v_otp;
  
  -- Return OTP (for development - in production, return success message only)
  RETURN v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Verify OTP function (same as before)
-- ============================================

CREATE OR REPLACE FUNCTION verify_otp_and_login(
  p_phone TEXT,
  p_otp TEXT
)
RETURNS JSON AS $$
DECLARE
  v_formatted_phone TEXT;
  v_otp_record RECORD;
  v_user_record RECORD;
  v_is_new BOOLEAN := false;
  v_email TEXT;
  v_user_id UUID;
BEGIN
  -- Format phone number
  v_formatted_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  
  IF LENGTH(v_formatted_phone) = 10 AND LEFT(v_formatted_phone, 1) = '9' THEN
    v_formatted_phone := '977' || v_formatted_phone;
  ELSIF LEFT(v_formatted_phone, 1) = '0' AND LENGTH(v_formatted_phone) = 11 THEN
    v_formatted_phone := '977' || SUBSTRING(v_formatted_phone, 2);
  END IF;
  
  -- Check OTP
  SELECT * INTO v_otp_record
  FROM otp_codes
  WHERE phone = v_formatted_phone
  AND otp = p_otp
  AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired OTP'
    );
  END IF;
  
  -- Delete used OTP
  DELETE FROM otp_codes WHERE phone = v_formatted_phone;
  
  -- Check if user exists
  SELECT * INTO v_user_record
  FROM user_profiles
  WHERE phone = v_formatted_phone;
  
  IF NOT FOUND THEN
    -- Create new user
    v_is_new := true;
    v_email := v_formatted_phone || '@phone.selfcarrental.com';
    v_user_id := gen_random_uuid();
    
    -- Insert into user_profiles
    INSERT INTO user_profiles (id, phone, full_name, email, created_at)
    VALUES (v_user_id, v_formatted_phone, 'User ' || RIGHT(v_formatted_phone, 4), v_email, NOW())
    RETURNING * INTO v_user_record;
  ELSE
    v_user_id := v_user_record.id;
    v_email := v_user_record.email;
  END IF;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'is_new', v_is_new,
    'phone', v_formatted_phone,
    'email', v_email,
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_and_send_otp(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_otp_and_login(TEXT, TEXT) TO anon, authenticated;

-- ============================================
-- TEST IT
-- ============================================

-- Test OTP generation
SELECT generate_and_send_otp('9812345678');

-- This should return a 4-digit OTP
-- Check the otp_codes table:
SELECT * FROM otp_codes;

-- ============================================
-- IMPORTANT: This version does NOT send SMS
-- It only generates OTP and stores it in database
-- You'll see the OTP in the browser console
-- Use this for testing the flow without SMS costs
-- ============================================
