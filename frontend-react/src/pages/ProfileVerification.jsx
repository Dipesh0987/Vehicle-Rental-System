import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { upsertProfile } from '../services/auth.service';

export default function ProfileVerification() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ 
    fullName: profile?.full_name || '', 
    phone: profile?.phone || '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true); setMessage(null);
    try {
      await upsertProfile(user.id, { 
        full_name: form.fullName,
        phone: form.phone 
      });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) { 
      setMessage({ type: 'error', text: err.message }); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const verificationStatus = profile?.verification_status;
  const inputCls = "w-full rounded-xl border border-[rgba(23,57,60,0.2)] bg-white px-3 py-2 text-[13px] text-[#1a3437] outline-none transition focus:border-[rgba(44,118,110,0.58)] focus:shadow-[0_0_0_4px_rgba(44,118,110,0.12)]";

  return (
    <main className="vrs-theme-scope relative mx-auto min-h-screen w-[95%] max-w-[1220px] py-8 font-poppins">
      <section className="profile-verify-shell relative overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.9),rgba(242,247,244,0.72))] p-4 shadow-[0_30px_70px_rgba(7,31,34,0.17)] backdrop-blur-[10px] sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(15,58,61,0.14)] pb-4">
          <div className="space-y-1">
            <Link to="/vehicles" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#355456] transition hover:text-[#145f59]">&larr; Back to Vehicles</Link>
            <h1 className="text-[24px] font-extrabold leading-tight text-[#12393c] sm:text-[30px]">My Profile</h1>
            <p className="text-[13px] text-[#3f5658] sm:text-[14px]">View and update your profile information.</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#466063]">Status</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
        </div>

        {/* Message */}
        {message?.type === 'success' && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
            {message.text}
          </div>
        )}
        {message?.type === 'error' && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {message.text}
          </div>
        )}

        {/* Profile Info Card */}
        <div className="mt-6 rounded-2xl border border-[rgba(18,57,60,0.14)] bg-white/90 p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative h-[80px] w-[80px] overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(150deg,#2c766e,#e58c4e)] shadow-[0_8px_20px_rgba(22,53,56,0.2)] flex items-center justify-center">
              <span className="text-[28px] font-bold text-white">
                {(profile?.full_name || user?.email)?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="text-[20px] font-bold text-[#12393c]">{profile?.full_name || 'User'}</p>
              <p className="text-[13px] text-[#5a7072]">{profile?.phone || user?.phone || 'No phone'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[12px] font-semibold text-[#2a4548]">Full Name</span>
                <input 
                  type="text" 
                  value={form.fullName} 
                  onChange={update('fullName')} 
                  className={inputCls} 
                  placeholder="Your full name"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[12px] font-semibold text-[#2a4548]">Phone Number</span>
                <input 
                  type="tel" 
                  value={form.phone} 
                  onChange={update('phone')} 
                  className={inputCls} 
                  placeholder="Your phone number"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button 
                type="submit" 
                disabled={submitting} 
                className="rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition hover:-translate-y-px hover:brightness-105 hover:shadow-[0_10px_22px_rgba(229,140,78,0.32)] disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
              <Link 
                to="/vehicles" 
                className="rounded-full border border-[rgba(20,64,67,0.24)] px-5 py-2.5 text-[13px] font-semibold text-[#2f4f52] transition hover:-translate-y-px hover:bg-white"
              >
                Back to Vehicles
              </Link>
            </div>
          </form>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link 
            to="/my-bookings" 
            className="rounded-xl border border-[rgba(18,57,60,0.14)] bg-white/80 p-4 text-center transition hover:-translate-y-px hover:shadow-lg"
          >
            <p className="text-[14px] font-semibold text-[#2a4548]">My Bookings</p>
            <p className="text-[12px] text-[#5a7072]">View your rental history</p>
          </Link>
          <Link 
            to="/vehicles" 
            className="rounded-xl border border-[rgba(18,57,60,0.14)] bg-white/80 p-4 text-center transition hover:-translate-y-px hover:shadow-lg"
          >
            <p className="text-[14px] font-semibold text-[#2a4548]">Browse Vehicles</p>
            <p className="text-[12px] text-[#5a7072]">Find your next rental</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
