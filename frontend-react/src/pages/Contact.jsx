import { useState } from 'react';
import supabase from '../lib/supabase';
import { AnimatedSection } from '../components/AnimatedSection';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await supabase.from('contact_messages').insert({ name: form.name, email: form.email, subject: form.subject, message: form.message });
      // Admin notification
      await supabase.from('notifications').insert({
        user_id: null,
        is_admin: true,
        type: 'contact',
        title: `New Contact Message from ${form.name}`,
        body: `Subject: ${form.subject} — ${form.message.slice(0, 120)}`,
        message: form.message,
        link_url: '/admin/contacts',
        metadata: { email: form.email, subject: form.subject },
      });
    } catch (_) {}
    setSubmitted(true);
    setSending(false);
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border-[1.5px] border-[#dfe3dc] dark:border-white/10 bg-[#F8F9F7] dark:bg-[#1c2a2e] font-poppins text-sm text-ink dark:text-[#e2e8f0] outline-none transition-[border-color,box-shadow,background] duration-200 box-border hover:border-[#c5ccc2] dark:hover:border-white/[0.18] focus:border-[#145f59] dark:focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(20,95,89,0.1)] dark:focus:shadow-[0_0_0_3px_rgba(44,118,110,0.2)] focus:bg-white dark:focus:bg-[#1a2528] placeholder:text-[#b0b5b1] dark:placeholder:text-[#5a6a6e]";

  return (
    <main className="min-h-screen">
      {/* Hero Banner */}
      <div className="vrs-theme-scope relative overflow-hidden bg-[linear-gradient(135deg,#0e2528_0%,#145f59_50%,#1a7a72_100%)] dark:bg-[linear-gradient(135deg,#0a1a1d_0%,#0e3a36_50%,#114a45_100%)] px-6 pt-14 pb-12 md:pt-[72px] md:pb-16 text-center before:content-[''] before:absolute before:-top-[60%] before:-right-[20%] before:w-[500px] before:h-[500px] before:rounded-full before:bg-[radial-gradient(circle,rgba(229,140,78,0.15),transparent_70%)] before:pointer-events-none after:content-[''] after:absolute after:-bottom-[40%] after:-left-[10%] after:w-[400px] after:h-[400px] after:rounded-full after:bg-[radial-gradient(circle,rgba(44,118,110,0.2),transparent_70%)] after:pointer-events-none">
        <h1 className="font-poppins text-[38px] md:text-[48px] font-extrabold text-white m-0 relative">Get in <span className="text-accent">Touch</span></h1>
        <p className="font-poppins text-[15px] text-white/70 mt-3 max-w-[480px] mx-auto leading-[1.6] relative">Have questions about our rental services? We'd love to hear from you. Our team is always ready to help.</p>
      </div>

      {/* Main Content */}
      <div className="vrs-theme-scope bg-[#F2F3F1] dark:bg-[#0f171a] px-5 pt-12 pb-16 md:px-6 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">

          {/* Left: Contact Info */}
          <AnimatedSection animation="fadeLeft">
            <div className="bg-white dark:bg-[#182226] rounded-[20px] px-7 py-8 md:px-9 md:py-10 shadow-[0_4px_24px_rgba(12,35,38,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border border-black/[0.04] dark:border-white/[0.06] transition-[box-shadow,transform] duration-300 hover:shadow-[0_12px_40px_rgba(12,35,38,0.1)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] hover:-translate-y-0.5">
            <h2 className="font-poppins text-2xl font-bold text-ink dark:text-[#e2e8f0] mb-7 mt-0">Contact Information</h2>

            {/* Phone */}
            <a href="tel:+9779704520781" className="flex items-center gap-4 p-4 rounded-[14px] bg-[#F8F9F7] dark:bg-[#1c2a2e] mb-3.5 transition-[background,box-shadow,transform] duration-200 no-underline text-inherit cursor-pointer hover:bg-[#f0f2ee] dark:hover:bg-[#223438] hover:shadow-[0_4px_16px_rgba(12,35,38,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:-translate-y-px">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-[rgba(20,95,89,0.1)] dark:bg-[rgba(20,95,89,0.2)] text-[#145f59] dark:text-[#5bbfb5]">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
              <div>
                <p className="font-poppins text-[15px] font-semibold text-ink dark:text-[#e2e8f0] m-0">+977 970-452-0781</p>
                <p className="font-poppins text-xs text-muted dark:text-[#8a9298] mt-0.5 mb-0">Available Mon to Sat, 9AM to 6PM</p>
              </div>
            </a>

            {/* Email */}
            <a href="mailto:info@rentavehicle.com" className="flex items-center gap-4 p-4 rounded-[14px] bg-[#F8F9F7] dark:bg-[#1c2a2e] mb-3.5 transition-[background,box-shadow,transform] duration-200 no-underline text-inherit cursor-pointer hover:bg-[#f0f2ee] dark:hover:bg-[#223438] hover:shadow-[0_4px_16px_rgba(12,35,38,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:-translate-y-px">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-[rgba(229,140,78,0.12)] dark:bg-[rgba(229,140,78,0.15)] text-[#c97a3a] dark:text-[#e5a05e]">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
                </svg>
              </div>
              <div>
                <p className="font-poppins text-[15px] font-semibold text-ink dark:text-[#e2e8f0] m-0">info@rentavehicle.com</p>
                <p className="font-poppins text-xs text-muted dark:text-[#8a9298] mt-0.5 mb-0">Response within 24 hours</p>
              </div>
            </a>

            {/* Address */}
            <a href="https://maps.google.com/?q=Self+Drive+Kathmandu+Banasthali" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-[14px] bg-[#F8F9F7] dark:bg-[#1c2a2e] mb-3.5 transition-[background,box-shadow,transform] duration-200 no-underline text-inherit cursor-pointer hover:bg-[#f0f2ee] dark:hover:bg-[#223438] hover:shadow-[0_4px_16px_rgba(12,35,38,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:-translate-y-px">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-[rgba(20,95,89,0.1)] dark:bg-[rgba(20,95,89,0.2)] text-[#145f59] dark:text-[#5bbfb5]">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <p className="font-poppins text-[15px] font-semibold text-ink dark:text-[#e2e8f0] m-0">Self Drive Kathmandu</p>
                <p className="font-poppins text-xs text-muted dark:text-[#8a9298] mt-0.5 mb-0">Banasthali · Open in Maps</p>
              </div>
            </a>

            {/* WhatsApp */}
            <a href="https://wa.me/9779704520781?text=Hi%2C%20I%27m%20interested%20in%20renting%20a%20vehicle." target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-[14px] bg-[#F8F9F7] dark:bg-[#1c2a2e] mb-3.5 transition-[background,box-shadow,transform] duration-200 no-underline text-inherit cursor-pointer hover:bg-[#f0f2ee] dark:hover:bg-[#223438] hover:shadow-[0_4px_16px_rgba(12,35,38,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:-translate-y-px">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-[rgba(37,211,102,0.1)] dark:bg-[rgba(37,211,102,0.15)] text-[#25d366] dark:text-[#34d76a]">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="font-poppins text-[15px] font-semibold text-ink dark:text-[#e2e8f0] m-0">WhatsApp</p>
                <p className="font-poppins text-xs text-muted dark:text-[#8a9298] mt-0.5 mb-0">Chat with us instantly</p>
              </div>
            </a>

            {/* Business Hours */}
            <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.1em] text-muted dark:text-[#8a9298] mt-8 mb-4 pt-6 border-t border-[#e8ebe6] dark:border-white/[0.08]">Business Hours</div>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] mb-2 bg-[#F8F9F7] dark:bg-[#1c2a2e] transition-colors duration-200 hover:bg-[#f0f2ee] dark:hover:bg-[#223438]">
              <span className="font-poppins text-sm font-semibold text-ink dark:text-[#e2e8f0]">Monday to Friday</span>
              <span className="font-poppins text-xs font-semibold px-3 py-1 rounded-[20px] bg-[#145f59] text-white">09:00 to 18:00</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] mb-2 bg-[#F8F9F7] dark:bg-[#1c2a2e] transition-colors duration-200 hover:bg-[#f0f2ee] dark:hover:bg-[#223438]">
              <span className="font-poppins text-sm font-semibold text-ink dark:text-[#e2e8f0]">Saturday</span>
              <span className="font-poppins text-xs font-semibold px-3 py-1 rounded-[20px] bg-accent text-white">10:00 to 15:00</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] mb-2 bg-[#F8F9F7] dark:bg-[#1c2a2e] transition-colors duration-200 hover:bg-[#f0f2ee] dark:hover:bg-[#223438]">
              <span className="font-poppins text-sm font-semibold text-ink dark:text-[#e2e8f0]">Sunday</span>
              <span className="font-poppins text-xs font-semibold px-3 py-1 rounded-[20px] bg-[#e8ebe6] dark:bg-[#2a383d] text-muted dark:text-[#8a9298]">Closed</span>
            </div>
          </div>
          </AnimatedSection>

          {/* Right: Contact Form */}
          <AnimatedSection animation="fadeRight">
          <div className="bg-white dark:bg-[#182226] rounded-[20px] px-7 py-8 md:px-9 md:py-10 shadow-[0_4px_24px_rgba(12,35,38,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border border-black/[0.04] dark:border-white/[0.06] transition-[box-shadow,transform] duration-300 hover:shadow-[0_12px_40px_rgba(12,35,38,0.1)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] hover:-translate-y-0.5">
            <h2 className="font-poppins text-2xl font-bold text-ink dark:text-[#e2e8f0] mb-7 mt-0">Send us a Message</h2>

            {submitted ? (
              <div className="text-center py-6">
                {/* Success Card */}
                <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#145f59_0%,#1a7a72_50%,#25d366_100%)] p-8 shadow-[0_20px_60px_rgba(20,95,89,0.3)]">
                  {/* Decorative circles */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10"></div>
                  <div className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-white/10"></div>
                  
                  {/* Animated Checkmark */}
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
                    <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#145f59" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-[bounce_0.5s_ease-out]">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* Success Text */}
                  <h3 className="font-poppins text-[28px] font-bold text-white mb-2">Thank You!</h3>
                  <p className="font-poppins text-lg text-white/90 mb-1">Your message has been sent successfully</p>
                  <p className="font-poppins text-sm text-white/70">We'll get back to you within 24 hours</p>
                  
                  {/* Reference Number */}
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-white text-[18px]">schedule</span>
                    <span className="font-poppins text-sm text-white font-medium">Response time: 24 hours</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="rounded-[14px] border-2 border-[#145f59] bg-transparent px-6 py-3 font-poppins text-sm font-semibold text-[#145f59] transition hover:bg-[#145f59] hover:text-white"
                  >
                    Send Another Message
                  </button>
                  <a 
                    href="/vehicles"
                    className="rounded-[14px] bg-[linear-gradient(135deg,#145f59,#1a7a72)] px-6 py-3 font-poppins text-sm font-semibold text-white transition hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">directions_car</span>
                    Browse Vehicles
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">Full Name <span className="text-accent">*</span></label>
                  <input type="text" value={form.name} onChange={update('name')} placeholder="Your full name" required className={inputCls} />
                </div>
                <div className="mb-5">
                  <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">Email Address <span className="text-accent">*</span></label>
                  <input type="email" value={form.email} onChange={update('email')} placeholder="your@email.com" required className={inputCls} />
                </div>
                <div className="mb-5">
                  <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">Subject <span className="text-accent">*</span></label>
                  <input type="text" value={form.subject} onChange={update('subject')} placeholder="How can we help?" required className={inputCls} />
                </div>
                <div className="mb-5">
                  <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">Message <span className="text-accent">*</span></label>
                  <textarea value={form.message} onChange={update('message')} placeholder="Tell us more about your inquiry..." rows={5} required className={`${inputCls} resize-none min-h-[120px]`} />
                </div>
                <button type="submit" className="w-full py-3.5 px-6 border-none rounded-[14px] bg-[linear-gradient(135deg,#145f59,#1a7a72)] text-white font-poppins text-[15px] font-semibold cursor-pointer shadow-[0_8px_24px_rgba(20,95,89,0.25)] transition-[transform,box-shadow] duration-[180ms] mt-2 flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(20,95,89,0.35)] active:translate-y-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
                <p className="font-poppins text-xs text-muted dark:text-[#8a9298] text-center mt-4">We'll get back to you within 24 hours</p>
              </form>
            )}
          </div>
          </AnimatedSection>
        </div>

        {/* Map Section */}
        <AnimatedSection animation="fadeUp" className="mx-auto max-w-[1200px] px-5 pb-12 md:px-6 md:pb-16 mt-10">
          <div className="bg-white dark:bg-[#182226] rounded-[20px] overflow-hidden shadow-[0_4px_24px_rgba(12,35,38,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border border-black/[0.04] dark:border-white/[0.06]">
            <iframe className="w-full h-[280px] md:h-[360px] border-none block" title="Our Location" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14132.0!2d85.3!3d27.72!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb18fcb77fd4bd%3A0x58099b1deffed7e1!2sBanasthali%2C%20Kathmandu!5e0!3m2!1sen!2snp!4v1" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </AnimatedSection>
      </div>
    </main>
  );
}
