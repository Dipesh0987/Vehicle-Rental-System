-- ============================================================================
-- PHONE OTP AUTHENTICATION SYSTEM FOR NEPAL
-- ============================================================================

-- Table to store OTP codes
CREATE TABLE IF NOT EXISTS public.phone_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '5 minutes'),
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_otp_phone ON public.phone_otp(phone);

-- Enable RLS
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;

-- Only service role can access OTP table
CREATE POLICY "Service only" ON public.phone_otp
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to generate and store OTP
CREATE OR REPLACE FUNCTION public.generate_otp(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp text;
  v_phone_clean text;
BEGIN
  -- Clean phone number (remove spaces, dashes)
  v_phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');
  
  -- Ensure Nepal format (+977 or 977 prefix)
  IF LENGTH(v_phone_clean) = 10 AND SUBSTRING(v_phone_clean, 1, 1) = '9' THEN
    v_phone_clean := '977' || v_phone_clean;
  ELSIF LENGTH(v_phone_clean) = 10 AND SUBSTRING(v_phone_clean, 1, 2) = '98' THEN
    v_phone_clean := '977' || v_phone_clean;
  END IF;
  
  -- Generate 4-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  -- Delete old OTPs for this phone
  DELETE FROM public.phone_otp WHERE phone = v_phone_clean;
  
  -- Insert new OTP
  INSERT INTO public.phone_otp (phone, otp, expires_at)
  VALUES (v_phone_clean, v_otp, now() + interval '5 minutes');
  
  -- Return OTP (in production, this would trigger SMS instead)
  RETURN v_otp;
END;
$$;

-- Function to verify OTP and create/login user
CREATE OR REPLACE FUNCTION public.verify_otp_and_login(p_phone text, p_otp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone_clean text;
  v_otp_record public.phone_otp%ROWTYPE;
  v_user_id uuid;
  v_user_email text;
  v_existing_user auth.users%ROWTYPE;
BEGIN
  -- Clean phone number
  v_phone_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');
  
  IF LENGTH(v_phone_clean) = 10 AND SUBSTRING(v_phone_clean, 1, 1) = '9' THEN
    v_phone_clean := '977' || v_phone_clean;
  ELSIF LENGTH(v_phone_clean) = 10 AND SUBSTRING(v_phone_clean, 1, 2) = '98' THEN
    v_phone_clean := '977' || v_phone_clean;
  END IF;
  
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM public.phone_otp
  WHERE phone = v_phone_clean
    AND otp = p_otp
    AND expires_at > now()
    AND verified = false
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_otp_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
  END IF;
  
  -- Mark OTP as verified
  UPDATE public.phone_otp SET verified = true WHERE id = v_otp_record.id;
  
  -- Check if user already exists with this phone
  SELECT * INTO v_existing_user
  FROM auth.users
  WHERE phone = v_phone_clean
  LIMIT 1;
  
  IF v_existing_user IS NULL THEN
    -- Create new user with phone as email (Supabase requires email)
    v_user_email := v_phone_clean || '@phone.selfcarrental.com';
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, phone,
      encrypted_password, email_confirmed_at, phone_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_user_email,
      v_phone_clean,
      crypt(v_otp_record.otp || v_phone_clean, gen_salt('bf')), -- Use OTP+phone as password
      NOW(),
      NOW(),
      '{"provider":"phone","providers":["phone"]}',
      jsonb_build_object('phone', v_phone_clean, 'login_method', 'otp'),
      NOW(), NOW(),
      '', '', '', ''
    );
    
    -- Create identity
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'phone', v_phone_clean),
      'phone', v_user_id::text,
      NOW(), NOW(), NOW()
    );
    
    -- Profile will be auto-created by trigger
  ELSE
    v_user_id := v_existing_user.id;
    v_user_email := v_existing_user.email;
    
    -- Update last sign in
    UPDATE auth.users SET 
      last_sign_in_at = NOW(),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_user_email,
    'phone', v_phone_clean,
    'is_new', v_existing_user IS NULL
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_otp(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp_and_login(text, text) TO anon, authenticated;

-- ============================================================================
-- DONE! Now users can login with Nepali phone number + 4-digit OTP
-- ============================================================================
