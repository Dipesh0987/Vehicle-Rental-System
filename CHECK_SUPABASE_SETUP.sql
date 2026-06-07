-- ============================================
-- CHECK SUPABASE SETUP
-- Run these queries to verify everything is set up correctly
-- ============================================

-- 1. Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('generate_and_send_otp', 'verify_otp_and_login', 'send_sms_twilio', 'send_sms_sparrow');

-- Expected: Should return 4 rows

-- ============================================

-- 2. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('otp_codes', 'sms_config');

-- Expected: Should return 2 rows

-- ============================================

-- 3. Check SMS provider configuration
SELECT provider, is_active, config 
FROM sms_config;

-- Expected: Should show your SMS provider config

-- ============================================

-- 4. Check if HTTP extension is enabled
SELECT * FROM pg_extension WHERE extname = 'http';

-- Expected: Should return 1 row

-- ============================================

-- 5. Test OTP generation (without sending SMS)
-- This will generate OTP but might fail on SMS sending if not configured
-- Check the error message to see what's wrong

SELECT generate_and_send_otp('9812345678');

-- Expected: Should return 4-digit OTP or show error message

-- ============================================
