-- ============================================
-- SUPABASE SMS OTP SYSTEM (No Firebase, No Separate Backend)
-- Uses Supabase Database Functions + HTTP Extension
-- Sends SMS via Twilio or Sparrow SMS directly from database
-- ============================================

-- Drop existing functions if they exist (to avoid conflicts)
DROP FUNCTION IF EXISTS generate_otp(TEXT);
DROP FUNCTION IF EXISTS verify_otp_and_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_and_send_otp(TEXT);
DROP FUNCTION IF EXISTS send_sms_twilio(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS send_sms_sparrow(TEXT, TEXT, JSONB);

-- Enable HTTP extension (allows database to make HTTP requests)
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- TABLE: Store OTP codes
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- ============================================
-- TABLE: SMS Configuration (Store API keys securely)
-- ============================================
CREATE TABLE IF NOT EXISTS sms_config (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL, -- 'twilio' or 'sparrowsms'
  config JSONB NOT NULL,  -- Store API keys as JSON
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default config (UPDATE WITH YOUR ACTUAL KEYS)
INSERT INTO sms_config (provider, config, is_active) VALUES
('twilio', '{
  "account_sid": "YOUR_TWILIO_ACCOUNT_SID",
  "auth_token": "YOUR_TWILIO_AUTH_TOKEN",
  "phone_number": "YOUR_TWILIO_PHONE_NUMBER"
}'::jsonb, false),
('sparrowsms', '{
  "token": "YOUR_SPARROW_SMS_TOKEN",
  "sender_id": "SelfCar"
}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNCTION: Send SMS via Twilio
-- ============================================
CREATE OR REPLACE FUNCTION send_sms_twilio(
  p_phone TEXT,
  p_message TEXT,
  p_config JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_account_sid TEXT;
  v_auth_token TEXT;
  v_from_number TEXT;
  v_url TEXT;
  v_auth TEXT;
  v_response http_response;
BEGIN
  -- Extract config
  v_account_sid := p_config->>'account_sid';
  v_auth_token := p_config->>'auth_token';
  v_from_number := p_config->>'phone_number';
  
  -- Build Twilio API URL
  v_url := 'https://api.twilio.com/2010-04-01/Accounts/' || v_account_sid || '/Messages.json';
  
  -- Create Basic Auth header
  v_auth := 'Basic ' || encode(v_account_sid || ':' || v_auth_token, 'base64');
  
  -- Make HTTP POST request to Twilio
  SELECT * INTO v_response FROM http((
    'POST',
    v_url,
    ARRAY[
      http_header('Authorization', v_auth),
      http_header('Content-Type', 'application/x-www-form-urlencoded')
    ],
    'application/x-www-form-urlencoded',
    'To=' || '+' || p_phone || '&From=' || v_from_number || '&Body=' || p_message
  )::http_request);
  
  -- Check response
  IF v_response.status >= 200 AND v_response.status < 300 THEN
    RAISE NOTICE 'SMS sent via Twilio to %', p_phone;
    RETURN true;
  ELSE
    RAISE WARNING 'Twilio API error: % - %', v_response.status, v_response.content;
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Send SMS via Sparrow SMS
-- ============================================
CREATE OR REPLACE FUNCTION send_sms_sparrow(
  p_phone TEXT,
  p_message TEXT,
  p_config JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_token TEXT;
  v_sender_id TEXT;
  v_url TEXT;
  v_phone_clean TEXT;
  v_response http_response;
  v_body TEXT;
BEGIN
  -- Extract config
  v_token := p_config->>'token';
  v_sender_id := p_config->>'sender_id';
  
  -- Clean phone number (remove 977 country code for Sparrow)
  v_phone_clean := REPLACE(p_phone, '977', '');
  
  -- Sparrow SMS API URL
  v_url := 'https://api.sparrowsms.com/v2/sms';
  
  -- Build JSON body
  v_body := json_build_object(
    'token', v_token,
    'from', v_sender_id,
    'to', v_phone_clean,
    'text', p_message
  )::text;
  
  -- Make HTTP POST request to Sparrow SMS
  SELECT * INTO v_response FROM http((
    'POST',
    v_url,
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_token),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    v_body
  )::http_request);
  
  -- Check response
  IF v_response.status >= 200 AND v_response.status < 300 THEN
    RAISE NOTICE 'SMS sent via Sparrow to %', p_phone;
    RETURN true;
  ELSE
    RAISE WARNING 'Sparrow SMS API error: % - %', v_response.status, v_response.content;
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Generate and Send OTP
-- ============================================
CREATE OR REPLACE FUNCTION generate_and_send_otp(p_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  v_otp TEXT;
  v_formatted_phone TEXT;
  v_message TEXT;
  v_config_record RECORD;
  v_sms_sent BOOLEAN := false;
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
  
  -- Create SMS message
  v_message := '🏎️ SelfCarRental' || E'\n\n' ||
               'Your verification code is: ' || v_otp || E'\n\n' ||
               'Valid for 5 minutes. Do not share this code with anyone.';
  
  -- Get active SMS provider config
  SELECT * INTO v_config_record
  FROM sms_config
  WHERE is_active = true
  ORDER BY id DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active SMS provider configured';
  END IF;
  
  -- Send SMS based on provider
  IF v_config_record.provider = 'twilio' THEN
    v_sms_sent := send_sms_twilio(v_formatted_phone, v_message, v_config_record.config);
  ELSIF v_config_record.provider = 'sparrowsms' THEN
    v_sms_sent := send_sms_sparrow(v_formatted_phone, v_message, v_config_record.config);
  ELSE
    RAISE EXCEPTION 'Unknown SMS provider: %', v_config_record.provider;
  END IF;
  
  IF NOT v_sms_sent THEN
    RAISE EXCEPTION 'Failed to send SMS';
  END IF;
  
  -- Return OTP (for development only - remove in production)
  RETURN v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Verify OTP and Login/Register
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

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION generate_and_send_otp(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_otp_and_login(TEXT, TEXT) TO anon, authenticated;

-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================
-- 1. Update SMS provider config in sms_config table with your actual API keys
-- 2. Call generate_and_send_otp('9812345678') to send OTP
-- 3. Call verify_otp_and_login('9812345678', '1234') to verify and login
-- ============================================

COMMENT ON FUNCTION generate_and_send_otp IS 'Generates OTP and sends SMS via configured provider (Twilio or Sparrow SMS)';
COMMENT ON FUNCTION verify_otp_and_login IS 'Verifies OTP and creates/logs in user';
