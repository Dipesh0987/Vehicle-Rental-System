import supabase from '../lib/supabase';

/**
 * Phone OTP Authentication Service for Nepal
 * Supports Nepali mobile numbers (Ncell, NTC, etc.)
 */

// Format Nepali phone number to standard format
export function formatNepaliPhone(phone) {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    // Format: 98XXXXXXXX or 97XXXXXXXX -> add 977 prefix
    cleaned = '977' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Format: 098XXXXXXXX or 097XXXXXXXX -> remove 0, add 977
    cleaned = '977' + cleaned.substring(1);
  } else if (cleaned.startsWith('+')) {
    // Already has +, just remove it
    cleaned = cleaned.replace('+', '');
  }
  
  return cleaned;
}

// Validate Nepali phone number
export function isValidNepaliPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  // Nepal mobile: +977 98XXXXXXXX or +977 97XXXXXXXX (10 digits after country code)
  const nepalPattern = /^(977)?(98|97)\d{8}$/;
  return nepalPattern.test(cleaned);
}

// Send OTP to phone number
export async function sendOTP(phone) {
  if (!isValidNepaliPhone(phone)) {
    throw new Error('Please enter a valid Nepali mobile number (e.g., 98XXXXXXXX)');
  }
  
  const formattedPhone = formatNepaliPhone(phone);
  
  // Call Supabase function to generate OTP
  const { data, error } = await supabase.rpc('generate_otp', {
    p_phone: formattedPhone
  });
  
  if (error) {
    console.error('OTP generation error:', error);
    throw new Error('Failed to send OTP. Please try again.');
  }
  
  // In production, the OTP is sent via SMS by the backend
  // For development, we return it so you can see it in console
  console.log('OTP for', formattedPhone, ':', data);
  
  return { 
    success: true, 
    phone: formattedPhone,
    // Only for development - remove in production
    devOtp: data 
  };
}

// Verify OTP and login/register user
export async function verifyOTPAndLogin(phone, otp) {
  if (!otp || otp.length !== 4) {
    throw new Error('Please enter the 4-digit OTP');
  }
  
  const formattedPhone = formatNepaliPhone(phone);
  
  const { data, error } = await supabase.rpc('verify_otp_and_login', {
    p_phone: formattedPhone,
    p_otp: otp
  });
  
  if (error) {
    console.error('OTP verification error:', error);
    throw new Error('Failed to verify OTP. Please try again.');
  }
  
  if (!data.success) {
    throw new Error(data.error || 'Invalid OTP');
  }
  
  // Now sign in with the created user using password (OTP+phone)
  const password = otp + formattedPhone;
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: password
  });
  
  if (signInError) {
    console.error('Sign in error:', signInError);
    throw new Error('Login failed after OTP verification');
  }
  
  return {
    user: signInData.user,
    session: signInData.session,
    isNewUser: data.is_new,
    phone: data.phone
  };
}

// Get current user's phone number from profile
export async function getUserPhone(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('phone, full_name')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data;
}
