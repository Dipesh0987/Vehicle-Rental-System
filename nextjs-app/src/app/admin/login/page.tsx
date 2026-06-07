'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminLogin() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const email = username.includes('@') ? username : `${username}@selfcarrental.com`;
      await signIn(email, password);
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-[radial-gradient(circle_at_top_right,#e4eee9_0%,#f5f1e8_48%,#ece7dc_100%)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,#f08f5f45,transparent_70%)] blur-[2px] animate-floatOrb"></div>
        <div className="absolute right-[-40px] top-[18%] h-96 w-96 rounded-full bg-[radial-gradient(circle,#1f766833,transparent_68%)] blur-[2px] animate-floatOrb" style={{ animationDelay: '450ms' }}></div>
        <div className="absolute bottom-[-80px] left-[22%] h-80 w-80 rounded-full bg-[radial-gradient(circle,#2f5f7b24,transparent_72%)] animate-floatOrb" style={{ animationDelay: '800ms' }}></div>
      </div>

      <main className="vrs-theme-scope mx-auto flex min-h-screen w-full max-w-[1240px] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="w-full max-w-[520px] rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_30px_68px_rgba(10,25,31,0.16)] backdrop-blur-[8px] animate-stageIn sm:p-6">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3f5557] transition hover:text-[#2C766E]">← Back to Home</Link>

          <div className="mt-4 rounded-2xl bg-[linear-gradient(120deg,rgba(31,118,104,0.11),rgba(240,143,95,0.12))] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Admin Sign In</p>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[32px]">Secure Dashboard Access</h1>
            <p className="mt-2 text-sm text-slate-700">Sign in with your admin email (or admin username alias) and password to continue.</p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block" htmlFor="adminUsername">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Admin Email or Username</span>
              <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <input id="adminUsername" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none" placeholder="your-admin@email.com or 'admin'" required />
              </div>
            </label>

            <label className="block" htmlFor="adminPassword">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Password</span>
              <div className="relative rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <input id="adminPassword" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-0 bg-transparent pr-11 text-sm font-semibold text-slate-900 outline-none" placeholder="Enter password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100" aria-label="Toggle password">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M2 12s3.8-6 10-6c2.2 0 4 .7 5.5 1.6" /><path d="M22 12s-3.8 6-10 6c-2.2 0-4-.7-5.5-1.6" /><path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label htmlFor="adminRememberMe" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input id="adminRememberMe" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span>Remember this admin session on this device</span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-[linear-gradient(135deg,#1f7668_0%,#2f5f7b_100%)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_16px_28px_rgba(20,73,89,0.28)] disabled:cursor-not-allowed disabled:opacity-65">
              {loading ? 'Signing in…' : 'Sign In to Admin'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
