import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  sendFirebaseOTP, 
  verifyFirebaseOTP, 
  setupRecaptcha,
  formatPhoneE164 
} from '../services/firebasePhoneAuth.service';

export default function LoginFirebase() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  const [step, setStep] = useState(1); // 1 = phone, 2 = OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  const recaptchaContainerRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  // Setup invisible reCAPTCHA on mount
  useEffect(() => {
    if (recaptchaContainerRef.current && !recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      } catch (err) {
        console.log('reCAPTCHA already initialized');
      }
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned;
    }
    return cleaned.slice(0, 10);
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');

    // Validate Nepali phone
    const cleaned = phone.replace(/\D/g, '');
    if (!/^(98|97)\d{8}$/.test(cleaned)) {
      setError('Please enter a valid Nepali mobile number (e.g., 98XXXXXXXX)');
      return;
    }

    setLoading(true);
    try {
      const result = await sendFirebaseOTP(phone, recaptchaVerifierRef.current);
      if (result.success) {
        setStep(2);
        setCountdown(60);
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
      // Reset reCAPTCHA
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyFirebaseOTP(otp);
      if (result.success) {
        await refreshSession();
        
        // Redirect
        const redirectTo = location.state?.redirectTo || '/vehicles';
        navigate(redirectTo);
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    setError('');
    try {
      const result = await sendFirebaseOTP(phone, recaptchaVerifierRef.current);
      if (result.success) {
        setCountdown(60);
        setOtp('');
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setOtp('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364]">
      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} className="hidden"></div>

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/10 bg-white/95 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2c766e] via-[#e58c4e] to-[#2c766e]"></div>
          
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-[26px] font-bold text-[#12373b]">
                {step === 1 ? 'Welcome Back' : 'Verify OTP'}
              </h1>
              <p className="mt-2 text-[14px] text-[#4a6668]">
                {step === 1 
                  ? 'Enter your phone number to login' 
                  : `Enter the 6-digit code sent to +977 ${phone}`}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                {error}
              </div>
            )}

            {/* Step 1: Phone Input */}
            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#2a4548]">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[#d2dfda] bg-[#f3f8f6] px-3 py-3 text-[14px] font-semibold text-[#2b4d50]">
                      +977
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="98XXXXXXXX"
                      maxLength={10}
                      className="flex-1 rounded-xl border border-[#d2dfda] bg-white px-4 py-3 text-[14px] text-[#1a3437] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]"
                      required
                    />
                  </div>
                  <p className="mt-1 text-[12px] text-[#5a7072]">
                    Enter your Nepali mobile number
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full rounded-full bg-gradient-to-r from-[#2c766e] to-[#e58c4e] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            )}

            {/* Step 2: OTP Input */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#2a4548]">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full rounded-xl border border-[#d2dfda] bg-white px-4 py-3 text-center text-[24px] font-bold tracking-[0.5em] text-[#1a3437] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-center text-[12px] text-[#5a7072]">
                    Didn't receive code?{' '}
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || loading}
                      className="font-semibold text-[#2c766e] hover:underline disabled:text-[#9ab0b2] disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full rounded-full bg-gradient-to-r from-[#2c766e] to-[#e58c4e] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full rounded-full border border-[#d0dbd6] bg-white px-6 py-3 text-[14px] font-semibold text-[#264447] transition hover:bg-[#f3f8f6]"
                >
                  Change Number
                </button>
              </form>
            )}

            {/* Footer */}
            <p className="mt-6 text-center text-[12px] text-[#5a7072]">
              Secured by{' '}
              <span className="font-semibold text-[#2c766e]">Firebase</span>
              {' '}• 10,000 free SMS/month
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
