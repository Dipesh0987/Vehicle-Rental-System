import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from '../services/auth.service';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  };

  const strength = getStrength(password);
  const levels = [
    { w: '0%', c: 'transparent', t: '' },
    { w: '25%', c: '#d9534f', t: 'Weak' },
    { w: '50%', c: '#d9884f', t: 'Fair' },
    { w: '75%', c: '#5cb85c', t: 'Good' },
    { w: '100%', c: '#145f59', t: 'Strong' },
  ];
  const level = levels[strength];

  const matchHint = !confirm ? '' : password === confirm ? 'Passwords match' : 'Passwords do not match';
  const matchColor = password === confirm ? '#145f59' : '#d9534f';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-poppins"
      style={{ background: 'radial-gradient(circle at 88% 8%, rgba(19,87,81,0.34), transparent 42%), radial-gradient(circle at 10% 88%, rgba(229,140,78,0.24), transparent 36%), linear-gradient(148deg, #f8faf8 0%, #eef3ef 50%, #e7edeb 100%)' }}>

      <div className="relative w-full max-w-[440px] rounded-[24px] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.93),rgba(242,247,244,0.76))] backdrop-blur-[10px] shadow-[0_28px_64px_rgba(7,31,34,0.15)] p-10 overflow-hidden animate-[cardSlideIn_0.5s_cubic-bezier(0.22,0.9,0.36,1)_0.06s_both] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-[linear-gradient(90deg,rgba(229,140,78,0.2),rgba(44,118,110,0.75),rgba(229,140,78,0.2))] before:pointer-events-none">

        {/* Icon */}
        <div className="w-[52px] h-[52px] mx-auto mb-4 flex items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#145f59,#1f7b73)] shadow-[0_8px_22px_rgba(20,95,89,0.25)] animate-[pulse-glow_2.6s_ease-in-out_infinite]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>

        <h1 className="text-[26px] font-bold text-center tracking-[-0.02em] leading-[1.15] text-[#1a2a2f] m-0">Reset Your Password</h1>
        <p className="text-center text-[13px] text-[#5f7378] mt-1.5 leading-[1.5]">Choose a strong new password for your account</p>

        {/* Banners */}
        {success && (
          <div className="rounded-[14px] px-4 py-3 text-center text-[13px] font-semibold mb-5 mt-5 border border-[rgba(44,118,110,0.2)] bg-[rgba(44,118,110,0.07)] text-[#145f59]">{success}</div>
        )}
        {error && (
          <div className="rounded-[14px] px-4 py-3 text-center text-[13px] font-semibold mb-5 mt-5 border border-[rgba(200,60,60,0.18)] bg-[rgba(200,60,60,0.05)] text-[#9b2c2c]">{error}</div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="mt-7">
            <div className="mb-5">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3a5558] mb-1.5">New Password</label>
              <div className="relative">
                <svg className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7a9a9e] pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  placeholder="Min 8 characters" autoComplete="new-password"
                  className="w-full py-[11px] pl-[42px] pr-[42px] rounded-[14px] border-[1.5px] border-[rgba(24,54,58,0.15)] bg-[rgba(255,255,255,0.82)] text-[14px] font-poppins text-[#1a2a2f] outline-none transition-[border-color,box-shadow] duration-200 box-border focus:border-[#145f59] focus:shadow-[0_0_0_3px_rgba(20,95,89,0.1)] placeholder:text-[#9bb0b4]" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-[12px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0.5 text-[#7a9a9e] hover:text-[#145f59] transition-colors" tabIndex={-1}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
              {/* Strength meter */}
              <div className={`h-1 rounded-sm bg-[rgba(24,54,58,0.07)] mt-2 overflow-hidden transition-opacity duration-250 ${password ? 'opacity-100' : 'opacity-0'}`}>
                <div className="h-full rounded-sm transition-[width,background-color] duration-350" style={{ width: level.w, backgroundColor: level.c }} />
              </div>
              {password && <p className="text-[11px] font-medium mt-1 min-h-[16px]" style={{ color: level.c }}>{level.t}</p>}
            </div>

            <div className="mb-6">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3a5558] mb-1.5">Confirm Password</label>
              <div className="relative">
                <svg className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7a9a9e] pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                  placeholder="Re-enter your password" autoComplete="new-password"
                  className="w-full py-[11px] pl-[42px] pr-[42px] rounded-[14px] border-[1.5px] border-[rgba(24,54,58,0.15)] bg-[rgba(255,255,255,0.82)] text-[14px] font-poppins text-[#1a2a2f] outline-none transition-[border-color,box-shadow] duration-200 box-border focus:border-[#145f59] focus:shadow-[0_0_0_3px_rgba(20,95,89,0.1)] placeholder:text-[#9bb0b4]" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-[12px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0.5 text-[#7a9a9e] hover:text-[#145f59] transition-colors" tabIndex={-1}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
              {matchHint && <p className="text-[11px] font-medium mt-1 min-h-[16px]" style={{ color: matchColor }}>{matchHint}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 px-6 border-none rounded-[16px] bg-[linear-gradient(135deg,#145f59,#1a7a72)] text-white font-poppins text-[14px] font-semibold cursor-pointer shadow-[0_10px_28px_rgba(20,95,89,0.3)] transition-[transform,box-shadow,opacity] duration-[180ms] mt-2 hover:-translate-y-px hover:shadow-[0_14px_34px_rgba(20,95,89,0.38)] active:translate-y-0 disabled:opacity-55 disabled:pointer-events-none">
              {loading ? (
                <><svg className="animate-spin w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg> Resetting…</>
              ) : (
                <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Reset Password</>
              )}
            </button>
          </form>
        )}

        {/* Back link */}
        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3f5557] no-underline transition-colors hover:text-[#145f59]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
