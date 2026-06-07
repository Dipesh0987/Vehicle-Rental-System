import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendOTP, isValidNepaliPhone, formatNepaliPhone } from '../services/phoneAuth.service';

export default function Login() {
  const { signInWithPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.redirectTo || '/';
  
  // Phone OTP states
  const [step, setStep] = useState(1); // 1: phone input, 2: OTP input
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState(null); // For development only

  // Handle Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isValidNepaliPhone(phone)) {
      setError('Please enter a valid Nepali mobile number (e.g., 98XXXXXXXX or 97XXXXXXXX)');
      return;
    }
    
    setLoading(true);
    try {
      const result = await sendOTP(phone);
      setDevOtp(result.devOtp); // For development - shows OTP in UI
      setStep(2);
      setCountdown(60);
      
      // Start countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP and Login
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!otp || otp.length !== 4) {
      setError('Please enter the 4-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      await signInWithPhone(phone, otp);
      navigate(redirectTo);
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const result = await sendOTP(phone);
      setDevOtp(result.devOtp);
      setCountdown(60);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep(1);
    setOtp('');
    setError('');
    setDevOtp(null);
  };

  return (
    <div className="vrs-page min-h-screen overflow-hidden bg-paper bg-[radial-gradient(circle_at_88%_8%,rgba(19,87,81,0.34),transparent_42%),radial-gradient(circle_at_10%_88%,rgba(229,140,78,0.24),transparent_36%),linear-gradient(148deg,#f8faf8_0%,#eef3ef_50%,#e7edeb_100%)] font-poppins text-ink">
      <main className="vrs-theme-scope relative mx-auto flex min-h-screen w-[95%] max-w-[1280px] items-center justify-center py-8 transition duration-200">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute right-[-100px] top-[-95px] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(229,140,78,0.78),rgba(229,140,78,0.12))] opacity-75 blur-[12px] animate-drift" aria-hidden="true"></div>
        <div className="pointer-events-none absolute bottom-[-95px] left-[-85px] h-[210px] w-[210px] rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(44,118,110,0.62),rgba(44,118,110,0.16))] opacity-75 blur-[12px] [animation-delay:600ms] animate-drift" aria-hidden="true"></div>
        <div className="pointer-events-none absolute right-[-36px] top-[-55px] h-[210px] w-[210px] rounded-full bg-[rgba(44,118,110,0.14)] blur-[5px]" aria-hidden="true"></div>

        <section className="vrs-auth-shell relative w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.9),rgba(242,247,244,0.72))] p-6 opacity-0 shadow-[0_30px_70px_rgba(7,31,34,0.17)] backdrop-blur-[10px] animate-loginStageIn sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(229,140,78,0.2),rgba(44,118,110,0.75),rgba(229,140,78,0.2))]"></div>
          <div className="grid gap-8 lg:grid-cols-[1.06fr,0.94fr] lg:items-center">

            {/* LEFT: Story side */}
            <aside className="vrs-auth-story space-y-4 opacity-0 animate-loginSectionIn [animation-delay:120ms]">
              <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3f5557] transition hover:text-panel">&larr; Back to Home</Link>
              <p className="inline-block rounded-full border border-[rgba(44,118,110,0.2)] bg-[#e8f2ef] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-panel">
                Secure Access
              </p>
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2b6a64]">
                <span className="h-[1px] w-10 origin-left bg-gradient-to-r from-panel to-transparent animate-accentPulse"></span>
                Executive Member Portal
              </div>
              <h1 className="max-w-[520px] text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">
                Welcome Back to Your Rental Command Center
              </h1>
              <p className="max-w-[560px] text-[14px] leading-relaxed text-[#405457] sm:text-[15px]">
                Access bookings, manage profile details, and control upcoming trips with enterprise-grade account security.
              </p>

              <div className="grid grid-cols-3 gap-2.5 opacity-0 animate-loginSectionIn [animation-delay:180ms] sm:gap-3">
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">24/7</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Support</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">99.9%</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Uptime</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">AES</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Encrypted</p>
                </div>
              </div>

              <figure className="vrs-auth-showcase mt-2 overflow-hidden rounded-[22px] border border-[rgba(23,57,60,0.16)] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(234,242,239,0.78))] shadow-[0_18px_34px_rgba(12,35,38,0.16)] animate-vehicleReveal">
                <div className="vrs-auth-showcase-media border-b border-[rgba(23,57,60,0.12)] bg-[radial-gradient(circle_at_80%_26%,rgba(255,255,255,0.94),rgba(255,255,255,0)_48%),linear-gradient(145deg,#eef4f0_0%,#dce8e4_100%)]">
                  <img loading="lazy" src="/assets/images/car-transparent.png" alt="Premium rental car"
                    className="block h-[188px] w-full object-contain object-[center_70%] px-2 pb-1 pt-1 [filter:contrast(1.08)_saturate(1.03)_drop-shadow(0_16px_24px_rgba(8,25,27,0.28))] animate-vehicleFloat" />
                </div>
                <figcaption className="vrs-auth-showcase-caption px-4 pb-4 pt-3 text-[13px] text-[#1e3b3e]">
                  <span className="vrs-auth-showcase-badge inline-block rounded-full border border-[rgba(44,118,110,0.26)] bg-[rgba(44,118,110,0.12)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#255753]">Premium Vehicle Collection</span>
                  <p className="mt-1 text-[15px] font-semibold leading-[1.35]">Drive in comfort with verified vehicles.</p>
                </figcaption>
              </figure>
            </aside>

            {/* RIGHT: Form */}
            <div className="vrs-auth-panel rounded-[24px] border border-white/70 bg-white/90 p-4 opacity-0 shadow-[0_20px_42px_rgba(10,31,34,0.14)] animate-loginSectionIn [animation-delay:220ms] sm:p-6">
              <div className="mb-3 rounded-2xl bg-[linear-gradient(110deg,rgba(15,70,67,0.08),rgba(229,140,78,0.08))] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#2f6a66]">Account Sign In</p>
                <p className="mt-1 text-[13px] text-[#345154]">Use your registered credentials to continue.</p>
              </div>

              {error && (
                <div className="vrs-auth-banner rounded-xl px-3 py-2 text-[13px] mb-2" style={{background:'rgba(220,38,38,0.08)',color:'#dc2626',border:'1px solid rgba(220,38,38,0.2)'}}>{error}</div>
              )}

              {/* Development Mode OTP Display */}
              {devOtp && (
                <div className="rounded-xl border border-dashed border-yellow-500 bg-yellow-50 px-3 py-3 text-[13px] text-yellow-800 mb-2">
                  <strong>Development Mode:</strong> Your OTP is <strong>{devOtp}</strong>
                  <br /><span className="text-xs">(In production, this will be sent via SMS)</span>
                </div>
              )}

              {step === 1 ? (
                /* Step 1: Phone Input */
                <form onSubmit={handleSendOTP} className="mt-1 space-y-4" noValidate>
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Mobile Number</span>
                    <div className="rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 transition focus-within:border-[rgba(44,118,110,0.58)] focus-within:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-[#4a6062] font-medium">+977</span>
                        <input 
                          type="tel" 
                          value={phone} 
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                          required 
                          maxLength="10"
                          className="w-full border-0 bg-transparent text-[14px] text-ink outline-none" 
                          placeholder="98XXXXXXXX or 97XXXXXXXX"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[12px] text-[#5a7072]">Enter your Nepali mobile number</p>
                  </label>

                  <button type="submit" disabled={loading || phone.length < 10}
                    className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:opacity-50">
                    {loading ? 'Sending…' : 'Send OTP'}
                  </button>

                  <p className="text-center text-[13px] text-[#3b5356]">
                    By continuing, you agree to our <Link to="/terms" className="font-semibold text-panel hover:underline">Terms</Link>
                  </p>
                </form>
              ) : (
                /* Step 2: OTP Input */
                <form onSubmit={handleVerifyOTP} className="mt-1 space-y-4" noValidate>
                  <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={goBack} className="text-[13px] text-panel hover:underline">
                      ← Change number
                    </button>
                    <span className="text-[13px] text-[#5a7072]">({formatNepaliPhone(phone)})</span>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Enter 4-digit OTP</span>
                    <div className="rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 transition focus-within:border-[rgba(44,118,110,0.58)] focus-within:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]">
                      <input 
                        type="text" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                        required 
                        maxLength="4"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="w-full border-0 bg-transparent text-center text-[24px] font-bold tracking-[0.5em] text-ink outline-none" 
                        placeholder="••••"
                      />
                    </div>
                    <p className="mt-1 text-[12px] text-[#5a7072]">Code sent to your mobile</p>
                  </label>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#5a7072]">
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Didn\'t receive code?'}
                    </span>
                    <button 
                      type="button" 
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || loading}
                      className="font-semibold text-panel hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      Resend OTP
                    </button>
                  </div>

                  <button type="submit" disabled={loading || otp.length !== 4}
                    className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:opacity-50">
                    {loading ? 'Verifying…' : 'Sign In'}
                  </button>

                  <p className="text-center text-[13px] text-[#5a7072]">
                    New users will be automatically registered
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
