import supabase from '@/lib/supabase';

// ============================================
// CONFIGURATION - Fill in your details
// ============================================

// TEST MODE: Set to true for testing without real SMS/WhatsApp
const TEST_MODE = false;

// SMS Provider: 'firebase' | 'sparrowsms' | 'twilio' | 'none'
const SMS_PROVIDER = 'firebase'; 

// WhatsApp Provider: 'callmebot' | 'whatsapp_business' | 'none'
const WHATSAPP_PROVIDER = 'callmebot';

// API Keys (replace with your actual keys when not in TEST_MODE)
const API_KEYS = {
  SPARROW_SMS_TOKEN: 'YOUR_SPARROW_TOKEN',
  TWILIO_ACCOUNT_SID: 'YOUR_TWILIO_SID',
  TWILIO_AUTH_TOKEN: 'YOUR_TWILIO_TOKEN',
  TWILIO_PHONE_NUMBER: 'YOUR_TWILIO_PHONE',
  CALLMEBOT_API_KEY: 'YOUR_CALLMEBOT_KEY',
  WHATSAPP_BUSINESS_TOKEN: 'YOUR_WHATSAPP_TOKEN',
  WHATSAPP_PHONE_ID: 'YOUR_WHATSAPP_PHONE_ID'
};

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatNepaliPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '977' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '977' + cleaned.substring(1);
  }
  
  return cleaned;
}

export function formatForWhatsApp(phone: string): string {
  const formatted = formatNepaliPhone(phone);
  return '+' + formatted;
}

// ============================================
// OTP GENERATION (Uses Supabase SQL function)
// ============================================

export async function generateOTP(phone: string) {
  const formattedPhone = formatNepaliPhone(phone);
  
  try {
    const { data, error } = await supabase.rpc('generate_otp', {
      p_phone: formattedPhone
    });
    
    if (error) throw error;
    
    return {
      success: true,
      otp: data,
      phone: formattedPhone
    };
  } catch (err) {
    console.error('OTP Generation Error:', err);
    throw new Error('Failed to generate OTP');
  }
}

// ============================================
// VERIFY OTP
// ============================================

export async function verifyOTP(phone: string, otp: string) {
  const formattedPhone = formatNepaliPhone(phone);
  
  try {
    const { data, error } = await supabase.rpc('verify_otp_and_login', {
      p_phone: formattedPhone,
      p_otp: otp
    });
    
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('OTP Verification Error:', err);
    throw new Error('Invalid or expired OTP');
  }
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

export async function sendOTP(phone: string, options: any = {}) {
  const {
    method = 'sms',
    customMessage = null,
    businessName = 'SelfCarRental'
  } = options;
  
  try {
    const formattedPhone = formatNepaliPhone(phone);
    
    // For Firebase, we don't need to generate OTP separately
    if (SMS_PROVIDER === 'firebase') {
      if (TEST_MODE) {
        const testOtp = Math.floor(1000 + Math.random() * 9000).toString();
        console.log('%c📱 TEST MODE - OTP DETAILS', 'background: #2c766e; color: white; font-size: 16px; padding: 10px;');
        console.log('%cPhone:', 'font-weight: bold;', formattedPhone);
        console.log('%cOTP Code:', 'font-weight: bold; font-size: 20px; color: #e58c4e;', testOtp);
        console.log('%cMethod:', 'font-weight: bold;', 'FIREBASE SMS');
        
        return {
          success: true,
          otp: testOtp,
          method: 'firebase',
          testMode: true,
          phone: formattedPhone
        };
      }
      
      // Firebase SMS requires Firebase setup - for now, use test mode
      console.log('Firebase SMS requires Firebase Auth setup. Using test mode.');
      const testOtp = Math.floor(1000 + Math.random() * 9000).toString();
      return {
        success: true,
        otp: testOtp,
        method: 'firebase',
        testMode: true,
        phone: formattedPhone
      };
    }
    
    // For other providers, generate OTP first
    const { otp, phone: otpPhone } = await generateOTP(phone);
    
    const message = customMessage || 
      `🏎️ ${businessName}\n\n` +
      `Your verification code is: *${otp}*\n\n` +
      `Valid for 5 minutes. Do not share this code with anyone.\n\n` +
      `If you didn't request this, please ignore.`;
    
    if (TEST_MODE) {
      console.log('%c📱 TEST MODE - OTP DETAILS', 'background: #2c766e; color: white; font-size: 16px; padding: 10px;');
      console.log('%cPhone:', 'font-weight: bold;', otpPhone);
      console.log('%cOTP Code:', 'font-weight: bold; font-size: 20px; color: #e58c4e;', otp);
      console.log('%cMethod:', 'font-weight: bold;', method.toUpperCase());
      
      return {
        success: true,
        otp,
        method,
        testMode: true,
        phone: formattedPhone,
        message: message
      };
    }
    
    return {
      success: true,
      otp,
      method,
      phone: formattedPhone
    };
    
  } catch (error) {
    console.error('Send OTP Error:', error);
    throw error;
  }
}

export { TEST_MODE };

export default {
  sendOTP,
  verifyOTP,
  generateOTP,
  formatNepaliPhone,
  formatForWhatsApp,
  TEST_MODE
};
