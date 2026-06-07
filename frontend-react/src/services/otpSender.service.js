/**
 * Dynamic OTP Sender Service
 * Supports: SMS (Firebase FREE, Sparrow SMS, Twilio) and WhatsApp (CallMeBot)
 */

import supabase from '../lib/supabase';
import { signInWithPhoneNumber, RecaptchaVerifier, auth } from '../lib/firebase';

// ============================================
// CONFIGURATION - Fill in your details
// ============================================

// TEST MODE: Set to true for testing without real SMS/WhatsApp
// In test mode, OTP is only logged to console (no real messages sent)
// SET TO FALSE FOR PRODUCTION - REAL SMS WILL BE SENT
const TEST_MODE = false;

// SMS Provider: 'firebase' | 'sparrowsms' | 'twilio' | 'none'
// 'firebase' = FREE 10,000 SMS/month via Firebase Auth
const SMS_PROVIDER = 'firebase'; 

// WhatsApp Provider: 'callmebot' | 'whatsapp_business' | 'none'
const WHATSAPP_PROVIDER = 'callmebot';

// API Keys (replace with your actual keys when not in TEST_MODE)
const API_KEYS = {
  // Sparrow SMS (Nepal) - https://sparrowsms.com
  SPARROW_SMS_TOKEN: 'YOUR_SPARROW_TOKEN',
  
  // Twilio - https://twilio.com
  TWILIO_ACCOUNT_SID: 'YOUR_TWILIO_SID',
  TWILIO_AUTH_TOKEN: 'YOUR_TWILIO_TOKEN',
  TWILIO_PHONE_NUMBER: 'YOUR_TWILIO_PHONE',
  
  // CallMeBot (Free WhatsApp) - https://www.callmebot.com/blog/free-api-whatsapp-messages/
  CALLMEBOT_API_KEY: 'YOUR_CALLMEBOT_KEY',
  
  // WhatsApp Business API - Meta
  WHATSAPP_BUSINESS_TOKEN: 'YOUR_WHATSAPP_TOKEN',
  WHATSAPP_PHONE_ID: 'YOUR_WHATSAPP_PHONE_ID'
};

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatNepaliPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Nepal formats
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '977' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '977' + cleaned.substring(1);
  }
  
  return cleaned;
}

export function formatForWhatsApp(phone) {
  const formatted = formatNepaliPhone(phone);
  return '+' + formatted;
}

// ============================================
// OTP GENERATION (Uses Supabase SQL function)
// ============================================

export async function generateOTP(phone) {
  const formattedPhone = formatNepaliPhone(phone);
  
  try {
    // Call Supabase function to generate and store OTP
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
// SMS SENDERS
// ============================================

// Sparrow SMS (Nepal)
async function sendSparrowSMS(phone, message) {
  const url = 'https://api.sparrowsms.com/v2/sms';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${API_KEYS.SPARROW_SMS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipients: phone.replace('977', ''), // Remove country code
      message: message,
      sender_id: 'SelfCar'
    })
  });
  
  if (!response.ok) {
    throw new Error('Sparrow SMS failed');
  }
  
  return await response.json();
}

// Twilio (International)
async function sendTwilioSMS(phone, message) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${API_KEYS.TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const body = new URLSearchParams({
    To: '+' + phone,
    From: API_KEYS.TWILIO_PHONE_NUMBER,
    Body: message
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${API_KEYS.TWILIO_ACCOUNT_SID}:${API_KEYS.TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  
  if (!response.ok) {
    throw new Error('Twilio SMS failed');
  }
  
  return await response.json();
}

// Firebase SMS (FREE 10,000/month via Firebase Auth)
// Uses Firebase Phone Auth to send real SMS
let firebaseRecaptchaVerifier = null;

export function setupFirebaseRecaptcha(containerId) {
  // Check if already initialized
  if (firebaseRecaptchaVerifier) {
    console.log('ℹ️ Firebase reCAPTCHA already initialized');
    return firebaseRecaptchaVerifier;
  }
  
  try {
    firebaseRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: (response) => {
        console.log('✅ Firebase reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('⚠️ Firebase reCAPTCHA expired, reinitializing...');
        firebaseRecaptchaVerifier = null;
      }
    });
    console.log('✅ Firebase reCAPTCHA initialized successfully');
    return firebaseRecaptchaVerifier;
  } catch (error) {
    console.error('❌ Firebase reCAPTCHA initialization error:', error);
    throw error;
  }
}

async function sendFirebaseSMS(phone, message) {
  const formattedPhone = formatForWhatsApp(phone); // +977XXXXXXXXXX
  
  // Auto-initialize reCAPTCHA if not already done
  if (!firebaseRecaptchaVerifier) {
    console.log('⚠️ reCAPTCHA not initialized, attempting auto-initialization...');
    try {
      // Try to find the container
      const container = document.getElementById('recaptcha-container');
      if (!container) {
        throw new Error('reCAPTCHA container not found. Make sure <div id="recaptcha-container"></div> exists in your component.');
      }
      setupFirebaseRecaptcha('recaptcha-container');
    } catch (initError) {
      console.error('❌ Auto-initialization failed:', initError);
      throw new Error('reCAPTCHA not initialized. Please refresh the page and try again.');
    }
  }
  
  try {
    // This sends REAL SMS via Firebase to the phone number
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, firebaseRecaptchaVerifier);
    
    // Store confirmation result for later verification
    window.firebaseConfirmationResult = confirmationResult;
    
    console.log('✅ Firebase SMS sent successfully to', formattedPhone);
    
    return {
      success: true,
      provider: 'firebase',
      message: 'SMS sent via Firebase Auth'
    };
  } catch (error) {
    console.error('❌ Firebase SMS error:', error);
    
    // Reset reCAPTCHA on error so it can be reinitialized
    firebaseRecaptchaVerifier = null;
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to send SMS. ';
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage += 'Invalid phone number format.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage += 'Too many requests. Please try again later.';
    } else if (error.code === 'auth/quota-exceeded') {
      errorMessage += 'SMS quota exceeded. Please contact support.';
    } else {
      errorMessage += error.message || 'Please try again.';
    }
    
    throw new Error(errorMessage);
  }
}

// ============================================
// WHATSAPP SENDERS
// ============================================

// CallMeBot (FREE WhatsApp API)
// Get API key: https://www.callmebot.com/blog/free-api-whatsapp-messages/
async function sendCallMeBotWhatsApp(phone, message) {
  const whatsappNumber = formatForWhatsApp(phone);
  
  // Remove + for CallMeBot
  const numberWithoutPlus = whatsappNumber.replace('+', '');
  
  const url = `https://api.callmebot.com/whatsapp.php?phone=${numberWithoutPlus}&text=${encodeURIComponent(message)}&apikey=${API_KEYS.CALLMEBOT_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('CallMeBot WhatsApp failed');
  }
  
  return await response.text();
}

// WhatsApp Business API (Meta)
async function sendWhatsAppBusiness(phone, message) {
  const whatsappNumber = formatForWhatsApp(phone);
  
  const url = `https://graph.facebook.com/v18.0/${API_KEYS.WHATSAPP_PHONE_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEYS.WHATSAPP_BUSINESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: whatsappNumber,
      type: 'text',
      text: {
        body: message
      }
    })
  });
  
  if (!response.ok) {
    throw new Error('WhatsApp Business API failed');
  }
  
  return await response.json();
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

export async function sendOTP(phone, options = {}) {
  const {
    method = 'sms', // 'sms' | 'whatsapp' | 'both'
    customMessage = null,
    businessName = 'SelfCarRental'
  } = options;
  
  try {
    const formattedPhone = formatNepaliPhone(phone);
    
    // For Firebase, we don't need to generate OTP separately
    // Firebase handles OTP generation and sending automatically
    if (SMS_PROVIDER === 'firebase') {
      // TEST MODE: Just log to console
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
      
      // Real Firebase SMS
      const message = customMessage || 
        `🏎️ ${businessName}\n\n` +
        `Your verification code will be sent by Firebase.\n\n` +
        `Valid for 5 minutes. Do not share this code with anyone.`;
      
      const result = await sendFirebaseSMS(formattedPhone, message);
      
      console.log('✅ Firebase SMS sent successfully');
      
      return {
        success: true,
        method: 'firebase',
        results: { sms: result },
        phone: formattedPhone
      };
    }
    
    // For other providers (Twilio, Sparrow), generate OTP first
    const { otp, phone: otpPhone } = await generateOTP(phone);
    
    // Create dynamic message
    const message = customMessage || 
      `🏎️ ${businessName}\n\n` +
      `Your verification code is: *${otp}*\n\n` +
      `Valid for 5 minutes. Do not share this code with anyone.\n\n` +
      `If you didn't request this, please ignore.`;
    
    // TEST MODE: Just log to console, don't send real messages
    if (TEST_MODE) {
      console.log('%c📱 TEST MODE - OTP DETAILS', 'background: #2c766e; color: white; font-size: 16px; padding: 10px;');
      console.log('%cPhone:', 'font-weight: bold;', otpPhone);
      console.log('%cOTP Code:', 'font-weight: bold; font-size: 20px; color: #e58c4e;', otp);
      console.log('%cMethod:', 'font-weight: bold;', method.toUpperCase());
      console.log('%cMessage:', 'font-weight: bold;', message);
      console.log('%c⏱️ Valid for 5 minutes', 'color: #666;');
      
      return {
        success: true,
        otp,
        method,
        testMode: true,
        phone: formattedPhone,
        message: message
      };
    }
    
    // Check if API keys are configured (not needed for Firebase)
    const missingConfig = [];
    if ((method === 'sms' || method === 'both') && SMS_PROVIDER === 'sparrowsms' && API_KEYS.SPARROW_SMS_TOKEN.includes('YOUR_')) {
      missingConfig.push('Sparrow SMS Token');
    }
    if ((method === 'whatsapp' || method === 'both') && WHATSAPP_PROVIDER === 'callmebot' && API_KEYS.CALLMEBOT_API_KEY.includes('YOUR_')) {
      missingConfig.push('CallMeBot API Key');
    }
    
    // Firebase doesn't need additional config - uses the firebase.js config already set up
    
    if (missingConfig.length > 0) {
      throw new Error(
        `SMS not configured. Missing: ${missingConfig.join(', ')}. ` +
        `Please edit otpSender.service.js and add your API keys, ` +
        `or set TEST_MODE = true to test without sending real SMS.`
      );
    }
    
    const results = {};
    
    // Send via SMS
    if (method === 'sms' || method === 'both') {
      try {
        if (SMS_PROVIDER === 'firebase') {
          results.sms = await sendFirebaseSMS(formattedPhone, message);
          console.log('📱 Firebase SMS sent to', formattedPhone);
        } else if (SMS_PROVIDER === 'sparrowsms') {
          results.sms = await sendSparrowSMS(formattedPhone, message);
        } else if (SMS_PROVIDER === 'twilio') {
          results.sms = await sendTwilioSMS(formattedPhone, message);
        }
      } catch (smsError) {
        console.error('SMS failed:', smsError);
        results.smsError = smsError.message;
      }
    }
    
    // Send via WhatsApp
    if (method === 'whatsapp' || method === 'both') {
      try {
        if (WHATSAPP_PROVIDER === 'callmebot') {
          results.whatsapp = await sendCallMeBotWhatsApp(formattedPhone, message);
        } else if (WHATSAPP_PROVIDER === 'whatsapp_business') {
          results.whatsapp = await sendWhatsAppBusiness(formattedPhone, message);
        }
      } catch (waError) {
        console.error('WhatsApp failed:', waError);
        results.whatsappError = waError.message;
      }
    }
    
    // Log for development
    console.log('📱 OTP Generated:', otp);
    console.log('📤 Send Results:', results);
    
    return {
      success: true,
      otp, // Return OTP for development testing
      method,
      results,
      phone: formattedPhone
    };
    
  } catch (error) {
    console.error('Send OTP Error:', error);
    throw error;
  }
}

// ============================================
// VERIFY OTP
// ============================================

export async function verifyOTP(phone, otp) {
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
// SETUP INSTRUCTIONS
// ============================================

export const SETUP_INSTRUCTIONS = {
  sparrowsms: `
    1. Go to https://sparrowsms.com
    2. Sign up and get your API token
    3. Replace 'YOUR_SPARROW_TOKEN' in this file
    4. Set SMS_PROVIDER = 'sparrowsms'
  `,
  
  twilio: `
    1. Go to https://twilio.com
    2. Get Account SID, Auth Token, and Phone Number
    3. Replace the TWILIO_* keys in this file
    4. Set SMS_PROVIDER = 'twilio'
  `,
  
  callmebot: `
    1. Go to https://www.callmebot.com/blog/free-api-whatsapp-messages/
    2. Add their WhatsApp number to your contacts
    3. Send them the activation message
    4. Get your free API key
    5. Replace 'YOUR_CALLMEBOT_KEY' in this file
    6. Set WHATSAPP_PROVIDER = 'callmebot'
  `,
  
  whatsapp_business: `
    1. Go to https://business.facebook.com
    2. Create a Meta Business account
    3. Go to WhatsApp Business Platform
    4. Get Phone ID and Access Token
    5. Replace the WHATSAPP_* keys in this file
    6. Set WHATSAPP_PROVIDER = 'whatsapp_business'
  `
};

export { TEST_MODE };

export default {
  sendOTP,
  verifyOTP,
  generateOTP,
  formatNepaliPhone,
  formatForWhatsApp,
  SETUP_INSTRUCTIONS,
  TEST_MODE
};
