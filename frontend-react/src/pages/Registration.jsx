import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Registration() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8 || !/[^a-zA-Z0-9]/.test(form.password)) {
      setError('Password must be at least 8 characters with one special character.');
      return;
    }

    setLoading(true);
    try {
      console.log('Registration attempt:', form.email);
      const result = await signUp(form.email, form.password, { full_name: form.fullName });
      console.log('Registration result:', result);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      console.error('Registration error:', err.message, err);
      const msg = err.message || 'Registration failed.';
      if (msg.toLowerCase().includes('already registered')) {
        setError('already_registered');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vrs-page min-h-screen overflow-hidden bg-paper bg-[radial-gradient(circle_at_86%_12%,rgba(19,87,81,0.34),transparent_42%),radial-gradient(circle_at_10%_88%,rgba(229,140,78,0.24),transparent_36%),linear-gradient(148deg,#f8faf8_0%,#eef3ef_50%,#e7edeb_100%)] font-poppins text-ink">
      <main className="vrs-theme-scope relative mx-auto flex min-h-screen w-[95%] max-w-[1280px] items-center justify-center py-8">
        <div className="pointer-events-none absolute right-[-100px] top-[-95px] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(229,140,78,0.78),rgba(229,140,78,0.12))] opacity-75 blur-[12px]" aria-hidden="true"></div>
        <div className="pointer-events-none absolute bottom-[-95px] left-[-85px] h-[210px] w-[210px] rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(44,118,110,0.62),rgba(44,118,110,0.16))] opacity-75 blur-[12px]" aria-hidden="true"></div>

        <section className="vrs-auth-shell relative w-full max-w-[1080px] overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.9),rgba(242,247,244,0.72))] p-6 opacity-0 shadow-[0_30px_70px_rgba(7,31,34,0.17)] backdrop-blur-[10px] animate-sectionIn sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.04fr,0.96fr] lg:items-center">

            {/* LEFT: Story side */}
            <aside className="vrs-auth-story space-y-4">
              <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3f5557] transition hover:text-panel">&larr; Back to Home</Link>
              <p className="inline-block rounded-full border border-[rgba(44,118,110,0.2)] bg-[#e8f2ef] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-panel">
                New Customer Onboarding
              </p>
              <h1 className="max-w-[520px] text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">
                Create Your Account and Start Booking Premium Vehicles
              </h1>
              <p className="max-w-[560px] text-[14px] leading-relaxed text-[#405457] sm:text-[15px]">
                Secure sign-up with modern authentication powered by Supabase. Start booking premium vehicles today.
              </p>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">Real</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Auth</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">Secure</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Passwords</p>
                </div>
                <div className="rounded-2xl border border-[rgba(23,57,60,0.12)] bg-white/75 px-3 py-2">
                  <p className="text-[18px] font-bold text-[#173d40]">Quick</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4b6668]">Onboarding</p>
                </div>
              </div>
            </aside>

            {/* RIGHT: Form */}
            <div className="vrs-auth-panel rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_42px_rgba(10,31,34,0.14)] sm:p-6">
              <div className="mb-3 rounded-2xl bg-[linear-gradient(110deg,rgba(15,70,67,0.08),rgba(229,140,78,0.08))] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#2f6a66]">Account Registration</p>
                <p className="mt-1 text-[13px] text-[#345154]">Use your full name, email, and a secure password.</p>
              </div>

              {error && (
                <div className="vrs-auth-banner rounded-xl px-3 py-2 text-[13px] mb-2" style={{background:'rgba(220,38,38,0.08)',color:'#dc2626',border:'1px solid rgba(220,38,38,0.2)'}}>
                  {error === 'already_registered' ? (
                    <span>This email is already registered. <Link to="/login" className="font-bold underline hover:text-[#b91c1c]">Please login here</Link></span>
                  ) : error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-[rgba(44,118,110,0.18)] bg-[rgba(232,242,239,0.72)] px-3 py-3 text-[13px] text-[#274e50] mb-2">
                  <p className="leading-relaxed">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-1 space-y-4" noValidate>
                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Full Name (Username)</span>
                  <input type="text" value={form.fullName} onChange={update('fullName')} required autoComplete="name" placeholder="Enter your full name"
                    className="w-full rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-[rgba(44,118,110,0.58)] focus:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Email</span>
                  <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" placeholder="you@example.com"
                    className="w-full rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-[rgba(44,118,110,0.58)] focus:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Password</span>
                  <input type="password" value={form.password} onChange={update('password')} required autoComplete="new-password" placeholder="At least 8 chars, 1 special character"
                    className="w-full rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-[rgba(44,118,110,0.58)] focus:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#2b4144]">Confirm Password</span>
                  <input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required autoComplete="new-password" placeholder="Re-enter password"
                    className="w-full rounded-xl border border-[rgba(23,57,60,0.17)] bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-[rgba(44,118,110,0.58)] focus:shadow-[0_0_0_4px_rgba(44,118,110,0.14)]" />
                </label>

                <div className="vrs-auth-policy rounded-xl border border-[rgba(44,118,110,0.24)] bg-[rgba(228,240,236,0.65)] px-3 py-2 text-[12px] text-[#264d4f]">
                  Password policy: minimum 8 characters and at least one special character.
                </div>

                <button type="submit" disabled={loading}
                  className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:opacity-50">
                  {loading ? 'Creating Account…' : 'Create Account'}
                </button>
              </form>

              <p className="mt-4 text-center text-[13px] text-[#3f575a]">
                Already have an account? <Link to="/login" className="font-semibold text-panel hover:underline">Sign In</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
