import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../lib/firebase';
import supabase from '../lib/supabase';

/**
 * Firebase Phone Authentication Service
 * 10,000 SMS/month FREE on Firebase Spark plan
 */

let confirmationResult = null;

// Format phone to E.164 format (+977XXXXXXXXXX)
export function formatPhoneE164(phone) {
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Nepal numbers
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '+977' + cleaned;
  } else if (cleaned.startsWith('977') && cleaned.length === 13) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

// Setup invisible reCAPTCHA
export function setupRecaptcha(containerId) {
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: (response) => {
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
    }
  });
  return verifier;
}

// Send OTP via Firebase (FREE up to 10,000/month)
export async function sendFirebaseOTP(phoneNumber, recaptchaVerifier) {
  const formattedPhone = formatPhoneE164(phoneNumber);
  
  try {
    confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Firebase OTP error:', error);
    throw new Error(error.message || 'Failed to send OTP');
  }
}

// Verify OTP and login
export async function verifyFirebaseOTP(otpCode) {
  if (!confirmationResult) {
    throw new Error('Please request OTP first');
  }
  
  try {
    const result = await confirmationResult.confirm(otpCode);
    const firebaseUser = result.user;
    
    // Get Firebase ID token
    const idToken = await firebaseUser.getIdToken();
    
    // Link Firebase user to Supabase
    const { data: userData, error: userError } = await linkFirebaseToSupabase(
      firebaseUser.phoneNumber,
      firebaseUser.uid,
      idToken
    );
    
    if (userError) throw userError;
    
    return {
      success: true,
      user: userData,
      isNewUser: result.additionalUserInfo?.isNewUser || false
    };
  } catch (error) {
    console.error('OTP verification error:', error);
    throw new Error('Invalid OTP code');
  }
}

// Link Firebase phone user to Supabase
async function linkFirebaseToSupabase(phone, firebaseUid, idToken) {
  // Format phone for Supabase
  const formattedPhone = phone.replace('+', '');
  
  // Check if user exists in Supabase
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('id, user_id')
    .eq('phone', formattedPhone)
    .single();
  
  if (existingUser) {
    // Existing user - get auth user
    const { data: authUser } = await supabase.auth.admin.getUserById(existingUser.user_id);
    
    // Sign in to Supabase using custom token
    const { data, error } = await supabase.auth.signInWithPassword({
      email: existingUser.user_id + '@firebase.phone',
      password: firebaseUid // Use Firebase UID as password
    });
    
    if (error) {
      // Try to create session manually
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithOtp({
        email: formattedPhone + '@phone.selfcarrental.com'
      });
      if (sessionError) throw sessionError;
      return sessionData;
    }
    
    return data;
  } else {
    // New user - create in Supabase
    const email = formattedPhone + '@phone.selfcarrental.com';
    const password = firebaseUid + Date.now(); // Random secure password
    
    const { data: newUser, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone: formattedPhone,
          firebase_uid: firebaseUid,
          full_name: 'User ' + formattedPhone.slice(-4)
        }
      }
    });
    
    if (signUpError) throw signUpError;
    
    return newUser;
  }
}

// Logout
export async function logoutFirebase() {
  await auth.signOut();
  await supabase.auth.signOut();
}

export default {
  sendFirebaseOTP,
  verifyFirebaseOTP,
  setupRecaptcha,
  logoutFirebase,
  formatPhoneE164
};
