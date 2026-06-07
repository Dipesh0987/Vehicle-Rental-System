import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendOTP, verifyOTP, formatNepaliPhone, setupFirebaseRecaptcha } from '../services/otpSender.service';

/**
 * Unified Phone Login & Registration with Real SMS OTP
 * - Single page for both login and registration
 * - Real SMS sent to actual phone numbers
 * - Supports multiple SMS providers (Firebase, Twilio, Sparrow SMS)
 */

export default function PhoneLogin() {
  const { signInWithPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.redirectTo || '/';
  
  // States
  const [step, setStep] = useState(1); // 1: phone input, 2: OTP verification
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  
  // For development/testing - shows OTP in console
  const [devOtp, setDevOtp] = useState(null);

  // Initialize Firebase reCAPTCHA on component mount
  useEffect(() => {
    try {
      setupFirebaseRecaptcha('recaptcha-container');
      console.log('✅ Firebase reCAPTCHA initialized');
    } catch (error) {
      console.error('❌ reCAPTCHA initialization error:', error);
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Validate Nepali phone number
  const isValidPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    // Nepal mobile: 98XXXXXXXX or 97XXXXXXXX (10 digits)
    return /^(98|97)\d{8}$/.test(cleaned);
  };

  // Handle Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isValidPhone(phone)) {
      setError('Please enter a valid Nepali mobile number (98XXXXXXXX or 97XXXXXXXX)');
      return;
    }
    
    setLoading(true);
    try {
      // Send OTP via Twilio (real SMS)
      const result = await sendOTP(phone, {
        method: 'sms',
        businessName: 'SelfCarRental'
      });
      
      console.log('✅ OTP sent successfully:', result);
      
      // Don't show OTP in UI for production (SMS sent to phone)
      // if (result.devOtp) {
      //   setDevOtp(result.devOtp);
      // }
      
      setOtpSent(true);
      setStep(2);
      setCountdown(60); // 60 seconds countdown
      
    } catch (err) {
      console.error('❌ Send OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP and Login/Register
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!otp || otp.length !== 4) {
      setError('Please enter the 4-digit OTP code');
      return;
    }
    
    setLoading(true);
    try {
      // Verify OTP via Supabase
      const result = await verifyOTP(phone, otp);
      
      if (!result.success) {
        throw new Error(result.error || 'Invalid OTP');
      }
      
      console.log('✅ OTP verified:', result);
      
      // Sign in with phone (creates account if new user)
      await signInWithPhone(phone, otp);
      
      // Navigate to intended page
      navigate(redirectTo);
      
    } catch (err) {
      console.error('❌ Verify OTP error:', err);
      setError(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setError('');
    setLoading(true);
    setDevOtp(null);
    
    try {
      const result = await sendOTP(phone, {
        method: 'sms',
        businessName: 'SelfCarRental'
      });
      
      // Don't show OTP in UI (sent via SMS)
      // if (result.devOtp) {
      //   setDevOtp(result.devOtp);
      // }
      
      setCountdown(60);
      console.log('✅ OTP resent successfully');
      
    } catch (err) {
      console.error('❌ Resend OTP error:', err);
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Go back to phone input
  const goBack = () => {
    setStep(1);
    setOtp('');
    setError('');
    setDevOtp(null);
    setOtpSent(false);
  };

  return (
    <div className="vrs-page min-h-screen overflow-hidden bg-paper bg-[radial-gradient(circle_at_88%_8%,rgba(19,87,81,0.34),transparent_42%),radial-gradient(circle_at_10%_88%,rgba(229,140,78,0.24),transparent_36%),linear-gradient(148deg,#f8faf8_0%,#eef3ef_50%,#e7edeb_100%)] font-poppins text-ink">
      <main className="vrs-theme-scope relative mx-auto flex min-h-screen w-[95%] max-w-[1280px] items-center justify-center py-8 transition duration-200">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute right-[-100px] top-[-95px] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(229,140,78,0.78),rgba(229,140,78,0.12))] opacity-75 blur-[12px] animate-drift" aria-hidden="true"></div>
        <div className="pointer-events-none absolute bottom-[-95px] left-[-85px] h-[210px] w-[210px] rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(44,118,110,0.62),rgba(44,118,110,0.16))] opacity-75 blur-[12px] [animation-delay:600ms] animate-drift" aria-hidden="true"></div>

        <section className="vrs-auth-shell relative w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.9),rgba(242,247,244,0.72))] p-6 opacity-0 shadow-[0_30px_70px_rgba(7,31,34,0.17)] backdrop-blur-[10px] animate-loginStageIn sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(229,140,78,0.2),rgba(44,118,110,0.75),rgba(229,140,78,0.2))]"></div>
          
          <div className="grid gap-8 lg:grid-cols-[1.06fr,0.94fr] lg:items-center">
            {/* LEFT: Story side */}
            <aside className="vrs-auth-story space-y-4 opacity-0 animate-loginSectionIn [animation-delay:120ms]">
              <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3f5557] transition hover:text-panel">
                &larr; Back to Home
              </Link>
              
              <p className="inline-block rounded-full border border-[rgba(44,118,110,0.2)] bg-[#e8f2ef] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-panel">
                📱 Phone Authentication
              </p>
              
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2b6a64]">
                <span className="h-[1px] w-10 origin-left bg-gradient-to-r from-panel to-transparent animate-accentPulse"></span>
                Secure SMS Verification
              </div>
              
              <h1 className="max-w-[520px] text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">
                Login or Register with Your Phone Number
              </h1>
              
              <p className="max-w-[560px] text-[14px] leading-relaxed text-[#405457] sm:text-[15px]">
                Fast and secure authentication using SMS OTP. No passwords to remember - just your phone number.
              </p>

              <div className="grid grid-cols-3 gap-2.5 opacity-0 animate-loginSectionIn [animation-delay:180ms] sm:gap-3">
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">📱</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Real SMS</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">🔒</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Secure</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">⚡</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Fast</p>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="space-y-2 pt-4">
                <div className="flex items-start gap-3">
                  <span className="text-[20px]">✓</span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#2b4144]">No Password Required</p>
                    <p className="text-[12px] text-[#5a7072]">Login instantly with OTP sent to your phone</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[20px]">✓</span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#2b4144]">Auto Registration</p>
                    <p className="text-[12px] text-[#5a7072]">New users are automatically registered</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[20px]">✓</span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#2b4144]">Secure & Encrypted</p>
                    <p className="text-[12px] text-[#5a7072]">Bank-grade security for your account</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* RIGHT: Form */}
            <div className="vrs-auth-panel rounded-[24px] border border-white/70 bg-white/90 p-4 opacity-0 shadow-[0_20px_42px_rgba(10,31,34,0.14)] animate-loginSectionIn [animation-delay:220ms] sm:p-6">
              
              {/* Firebase reCAPTCHA container (invisible) */}
              <div id="recaptcha-container"></div>
              
              {/* Header */}
              <div className="mb-4 rounded-2xl bg-[linear-gradient(110deg,rgba(15,70,67,0.08),rgba(229,140,78,0.08))] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#2f6a66]">
                  {step === 1 ? '📱 Enter Phone Number' : '🔐 Verify OTP'}
                </p>
                <p className="mt-1 text-[13px] text-[#345154]">
                  {step === 1 
                    ? 'We\'ll send a verification code to your phone' 
                    : 'Enter the 4-digit code sent to your phone'}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600">
                  {error}
                </div>
              )}

              {/* Development OTP Display */}
              {devOtp && (
                <div className="mb-3 rounded-xl border-2 border-dashed border-green-500 bg-green-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">Development Mode</p>
                  <p className="mt-1 text-[24px] font-bold tracking-[0.3em] text-green-800">{devOtp}</p>
                  <p className="mt-1 text-[11px] text-green-600">Use this code to verify (valid for 5 minutes)</p>
                </div>
              )}

              {step === 1 ? (
                /* STEP 1: Phone Number Input */
                <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">
                      Mobile Number
                    </span>
                    <div className="rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2.5 transition focus-within:border-[rgba(44,118,110,0.58)] focus-within:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-[#4a6062]">+977</span>
                        <input 
                          type="tel" 
                          value={phone} 
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                          required 
                          maxLength="10"
                          autoFocus
                          inputMode="numeric"
                          className="w-full border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#9ca8aa]" 
                          placeholder="98XXXXXXXX or 97XXXXXXXX"
                        />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#5a7072]">
                      Enter your Nepali mobile number (Ncell, NTC, etc.)
                    </p>
                  </label>

                  <button 
                    type="submit" 
                    disabled={loading || phone.length < 10}
                    className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending OTP...
                      </span>
                    ) : (
                      '📱 Send OTP'
                    )}
                  </button>

                  <p className="text-center text-[12px] text-[#5a7072]">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="font-semibold text-panel hover:underline">
                      Terms of Service
                    </Link>
                  </p>
                </form>
              ) : (
                /* STEP 2: OTP Verification */
                <form onSubmit={handleVerifyOTP} className="space-y-4" noValidate>
                  {/* Phone number display with edit option */}
                  <div className="flex items-center justify-between rounded-lg bg-[#f0f7f5] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#5a7072]">Sent to:</span>
                      <span className="text-[14px] font-semibold text-[#2b4144]">
                        +977 {phone}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={goBack}
                      className="text-[12px] font-semibold text-panel hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">
                      Verification Code
                    </span>
                    <div className="rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-3 transition focus-within:border-[rgba(44,118,110,0.58)] focus-within:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]">
                      <input 
                        type="text" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                        required 
                        maxLength="4"
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="w-full border-0 bg-transparent text-center text-[28px] font-bold tracking-[0.5em] text-ink outline-none placeholder:tracking-normal" 
                        placeholder="••••"
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#5a7072]">
                      Enter the 4-digit code sent to your phone
                    </p>
                  </label>

                  {/* Resend OTP */}
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#5a7072]">
                      {countdown > 0 ? (
                        <span>Resend code in <strong>{countdown}s</strong></span>
                      ) : (
                        'Didn\'t receive the code?'
                      )}
                    </span>
                    <button 
                      type="button" 
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || loading}
                      className="font-semibold text-panel hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                    >
                      Resend OTP
                    </button>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading || otp.length !== 4}
                    className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      '🔐 Verify & Continue'
                    )}
                  </button>

                  <p className="text-center text-[12px] text-[#5a7072]">
                    New users will be automatically registered
                  </p>
                </form>
              )}

              {/* Alternative login option */}
              <div className="mt-6 border-t border-[rgba(23,57,60,0.1)] pt-4">
                <p className="text-center text-[13px] text-[#5a7072]">
                  Prefer email login?{' '}
                  <Link to="/login-email" className="font-semibold text-panel hover:underline">
                    Use Email & Password
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
