/**
 * Supabase OTP Service (No Firebase, No Separate Backend)
 * Uses Supabase database functions to send SMS via Twilio/Sparrow
 * All SMS sending happens inside Supabase database
 */

import supabase from '../lib/supabase';

/**
 * Format Nepali phone number
 */
export function formatNepaliPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '977' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '977' + cleaned.substring(1);
  }
  
  return cleaned;
}

/**
 * Validate Nepali phone number
 */
export function isValidNepaliPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  const nepalPattern = /^(977)?(98|97)\d{8}$/;
  return nepalPattern.test(cleaned);
}

/**
 * Send OTP via Supabase database function
 * This function calls Supabase which then sends SMS via Twilio/Sparrow
 */
export async function sendOTP(phone) {
  if (!isValidNepaliPhone(phone)) {
    throw new Error('Please enter a valid Nepali mobile number (e.g., 98XXXXXXXX)');
  }
  
  const formattedPhone = formatNepaliPhone(phone);
  
  try {
    console.log('📱 Sending OTP to:', formattedPhone);
    
    // Call Supabase function which generates OTP and sends SMS
    const { data, error } = await supabase.rpc('generate_and_send_otp', {
      p_phone: formattedPhone
    });
    
    if (error) {
      console.error('❌ Supabase RPC error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Provide user-friendly error messages
      if (error.message.includes('No active SMS provider')) {
        throw new Error('SMS service not configured. Please contact support.');
      } else if (error.message.includes('Invalid Nepal phone number')) {
        throw new Error('Invalid phone number format. Use: 98XXXXXXXX or 97XXXXXXXX');
      } else if (error.message.includes('HTTP')) {
        throw new Error('SMS service temporarily unavailable. Please try again.');
      } else {
        throw new Error(error.message || 'Failed to send OTP. Please try again.');
      }
    }
    
    console.log('✅ OTP sent successfully to', formattedPhone);
    console.log('Response data:', data);
    
    // In development, the OTP is returned (remove in production)
    return { 
      success: true, 
      phone: formattedPhone,
      // Only for development - shows OTP in console
      devOtp: data 
    };
    
  } catch (err) {
    console.error('❌ Send OTP error:', err);
    throw err;
  }
}

/**
 * Verify OTP and login/register user
 */
export async function verifyOTP(phone, otp) {
  if (!otp || otp.length !== 4) {
    throw new Error('Please enter the 4-digit OTP');
  }
  
  const formattedPhone = formatNepaliPhone(phone);
  
  try {
    const { data, error } = await supabase.rpc('verify_otp_and_login', {
      p_phone: formattedPhone,
      p_otp: otp
    });
    
    if (error) {
      console.error('OTP verification error:', error);
      throw new Error(error.message || 'Failed to verify OTP. Please try again.');
    }
    
    if (!data.success) {
      throw new Error(data.error || 'Invalid OTP');
    }
    
    console.log('✅ OTP verified successfully');
    
    return {
      success: true,
      isNewUser: data.is_new,
      phone: data.phone,
      email: data.email,
      userId: data.user_id
    };
    
  } catch (err) {
    console.error('Verify OTP error:', err);
    throw new Error(err.message || 'Invalid or expired OTP. Please try again.');
  }
}

/**
 * Get current user's phone number from profile
 */
export async function getUserPhone(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('phone, full_name')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data;
}

export default {
  sendOTP,
  verifyOTP,
  getUserPhone,
  formatNepaliPhone,
  isValidNepaliPhone
};
