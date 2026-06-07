'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const SERVICE_TYPES = [
  { value: 'self_drive', label: 'Self-Drive' },
  { value: 'with_driver', label: 'With Driver' },
  { value: 'both', label: 'Both' },
];

const inputCls = "w-full px-4 py-3 rounded-xl border-[1.5px] border-[#dfe3dc] dark:border-white/10 bg-[#F8F9F7] dark:bg-[#1c2a2e] font-poppins text-sm text-ink dark:text-[#e2e8f0] outline-none transition-[border-color,box-shadow,background] duration-200 box-border hover:border-[#c5ccc2] dark:hover:border-white/[0.18] focus:border-[#145f59] dark:focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(20,95,89,0.1)] dark:focus:shadow-[0_0_0_3px_rgba(44,118,110,0.2)] focus:bg-white dark:focus:bg-[#1a2528] placeholder:text-[#b0b5b1] dark:placeholder:text-[#5a6a6e]";

export default function VendorEnquiry() {
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    email: '',
    phone: '',
    city: '',
    fleet_count: '',
    service_type: '',
    price_min: '',
    price_max: '',
    description: '',
    terms_accepted: false,
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      setErrors({ ...errors, images: 'Maximum 5 images allowed' });
      return;
    }
    const newImages = [...images, ...files].slice(0, 5);
    setImages(newImages);
    const newPreviews = newImages.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);
    if (newImages.length >= 3) setErrors({ ...errors, images: '' });
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newImages);
    setPreviews(newPreviews);
    if (newImages.length < 3) {
      setErrors({ ...errors, images: 'Minimum 3 images required' });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!form.business_name.trim()) newErrors.business_name = 'Business name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email format';
    if (!form.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^[+]?[\d\s-]{7,15}$/.test(form.phone.replace(/\s/g, ''))) newErrors.phone = 'Invalid phone format';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.fleet_count || parseInt(form.fleet_count) < 1) newErrors.fleet_count = 'Fleet count must be at least 1';
    if (!form.service_type) newErrors.service_type = 'Service type is required';
    if (!form.price_min || parseFloat(form.price_min) < 0) newErrors.price_min = 'Minimum price is required';
    if (!form.price_max || parseFloat(form.price_max) < 0) newErrors.price_max = 'Maximum price is required';
    if (parseFloat(form.price_min) > parseFloat(form.price_max)) newErrors.price_max = 'Max price must be greater than min';
    if (images.length < 3) newErrors.images = 'Minimum 3 images required';
    if (images.length > 5) newErrors.images = 'Maximum 5 images allowed';
    if (!form.terms_accepted) newErrors.terms_accepted = 'You must accept the terms and conditions';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSending(true);
    try {
      // Upload images to Supabase storage
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${image.name}`;
        const { data, error } = await supabase.storage
          .from('vendor-images')
          .upload(`enquiries/${fileName}`, image);
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from('vendor-images')
          .getPublicUrl(`enquiries/${fileName}`);
        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
      }

      // Insert enquiry into database
      const { error: insertError } = await supabase.from('vendor_enquiries').insert({
        full_name: form.full_name.trim(),
        business_name: form.business_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        fleet_count: parseInt(form.fleet_count),
        service_type: form.service_type,
        price_min: parseFloat(form.price_min),
        price_max: parseFloat(form.price_max),
        description: form.description.trim(),
        car_images: imageUrls,
        terms_accepted: form.terms_accepted,
        status: 'pending',
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrors({ ...errors, submit: err.message || 'Failed to submit enquiry' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="vrs-page min-h-screen bg-white font-poppins">
      <main id="app" className="vrs-theme-scope min-h-screen">
        <Header />
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0e2528_0%,#145f59_50%,#1a7a72_100%)] dark:bg-[linear-gradient(135deg,#0a1a1d_0%,#0e3a36_50%,#114a45_100%)] px-6 pt-14 pb-12 md:pt-[72px] md:pb-16 text-center before:content-[''] before:absolute before:-top-[60%] before:-right-[20%] before:w-[500px] before:h-[500px] before:rounded-full before:bg-[radial-gradient(circle,rgba(229,140,78,0.15),transparent_70%)] before:pointer-events-none after:content-[''] after:absolute after:-bottom-[40%] after:-left-[10%] after:w-[400px] after:h-[400px] after:rounded-full after:bg-[radial-gradient(circle,rgba(44,118,110,0.2),transparent_70%)] after:pointer-events-none">
          <h1 className="font-poppins text-[38px] md:text-[48px] font-extrabold text-white m-0 relative">
            Become a <span className="text-accent">Vendor</span>
          </h1>
          <p className="font-poppins text-[15px] text-white/70 mt-3 max-w-[520px] mx-auto leading-[1.6] relative">
            Partner with ASSelf and grow your car rental business. List your vehicles and reach thousands of customers looking for quality rentals.
          </p>
        </div>

        <div className="vrs-theme-scope bg-[#F2F3F1] dark:bg-[#0f171a] px-5 pt-12 pb-16 md:px-6 md:pt-16 md:pb-20">
          <div className="mx-auto max-w-[800px]">
            <div className="bg-white dark:bg-[#182226] rounded-[20px] px-7 py-8 md:px-9 md:py-10 shadow-[0_4px_24px_rgba(12,35,38,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border border-black/[0.04] dark:border-white/[0.06]">
              {submitted ? (
                <div className="text-center py-6">
                  <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#145f59_0%,#1a7a72_50%,#25d366_100%)] p-8 shadow-[0_20px_60px_rgba(20,95,89,0.3)]">
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10"></div>
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-white/10"></div>
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
                      <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#145f59" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    </div>
                    <h3 className="font-poppins text-[28px] font-bold text-white mb-2">Thank You!</h3>
                    <p className="font-poppins text-lg text-white/90 mb-1">Your vendor enquiry has been submitted</p>
                    <p className="font-poppins text-sm text-white/70">Our team will review your application and get back to you within 2-3 business days.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-poppins text-2xl font-bold text-ink dark:text-[#e2e8f0] mb-2">Vendor Registration Form</h2>
                  <p className="font-poppins text-sm text-muted dark:text-[#8a9298] mb-7">Fill in your details to register as a vendor partner with ASSelf.</p>

                  {errors.submit && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300">
                      {errors.submit}
                    </div>
                  )}
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Full Name <span className="text-accent">*</span>
                        </label>
                        <input type="text" value={form.full_name} onChange={update('full_name')} placeholder="Your full name" className={inputCls} />
                        {errors.full_name && <p className="text-rose-500 text-xs mt-1">{errors.full_name}</p>}
                      </div>
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Business Name <span className="text-accent">*</span>
                        </label>
                        <input type="text" value={form.business_name} onChange={update('business_name')} placeholder="Your company/business name" className={inputCls} />
                        {errors.business_name && <p className="text-rose-500 text-xs mt-1">{errors.business_name}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Email Address <span className="text-accent">*</span>
                        </label>
                        <input type="email" value={form.email} onChange={update('email')} placeholder="your@email.com" className={inputCls} />
                        {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Phone Number <span className="text-accent">*</span>
                        </label>
                        <input type="tel" value={form.phone} onChange={update('phone')} placeholder="+977 98XXXXXXXX" className={inputCls} />
                        {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          City / Location <span className="text-accent">*</span>
                        </label>
                        <input type="text" value={form.city} onChange={update('city')} placeholder="e.g., Kathmandu" className={inputCls} />
                        {errors.city && <p className="text-rose-500 text-xs mt-1">{errors.city}</p>}
                      </div>
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Number of Cars in Fleet <span className="text-accent">*</span>
                        </label>
                        <input type="number" min="1" value={form.fleet_count} onChange={update('fleet_count')} placeholder="e.g., 5" className={inputCls} />
                        {errors.fleet_count && <p className="text-rose-500 text-xs mt-1">{errors.fleet_count}</p>}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                        Service Type <span className="text-accent">*</span>
                      </label>
                      <select value={form.service_type} onChange={update('service_type')} className={inputCls}>
                        <option value="">Select service type</option>
                        {SERVICE_TYPES.map(st => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                      {errors.service_type && <p className="text-rose-500 text-xs mt-1">{errors.service_type}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Min Price Per Day (NPR) <span className="text-accent">*</span>
                        </label>
                        <input type="number" min="0" value={form.price_min} onChange={update('price_min')} placeholder="e.g., 3000" className={inputCls} />
                        {errors.price_min && <p className="text-rose-500 text-xs mt-1">{errors.price_min}</p>}
                      </div>
                      <div>
                        <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                          Max Price Per Day (NPR) <span className="text-accent">*</span>
                        </label>
                        <input type="number" min="0" value={form.price_max} onChange={update('price_max')} placeholder="e.g., 8000" className={inputCls} />
                        {errors.price_max && <p className="text-rose-500 text-xs mt-1">{errors.price_max}</p>}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                        Brief Description
                      </label>
                      <textarea value={form.description} onChange={update('description')} placeholder="Tell us about your car rental business..." rows={4} className={`${inputCls} resize-none min-h-[100px]`} />
                    </div>

                    {/* Image Upload Section */}
                    <div className="mb-6">
                      <label className="block font-poppins text-[13px] font-semibold text-ink dark:text-[#cbd5e1] mb-1.5">
                        Upload Car Images <span className="text-accent">*</span>
                        <span className="font-normal text-muted ml-1">(3-5 images)</span>
                      </label>
                      <div className="border-2 border-dashed border-[#dfe3dc] dark:border-white/10 rounded-xl p-6 text-center hover:border-[#145f59] dark:hover:border-[#2c766e] transition-colors">
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#145f59] text-white font-semibold text-sm hover:bg-[#0e4a45] transition">
                          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                          Choose Images
                        </button>
                        <p className="text-xs text-muted dark:text-[#8a9298] mt-2">Supported: JPG, PNG, WEBP (Max 5MB each)</p>
                      </div>
                      {errors.images && <p className="text-rose-500 text-xs mt-1">{errors.images}</p>}

                      {/* Image Previews */}
                      {previews.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
                          {previews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-white/10" />
                              <button type="button" onClick={() => removeImage(index)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-rose-600">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted dark:text-[#8a9298] mt-2">{images.length}/5 images selected</p>
                    </div>

                    {/* Terms & Conditions Checkbox */}
                    <div className="mb-6 p-4 rounded-xl bg-[#F8F9F7] dark:bg-[#1c2a2e] border border-[#e8ebe6] dark:border-white/[0.08]">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.terms_accepted} onChange={update('terms_accepted')} className="mt-1 w-5 h-5 rounded border-[#dfe3dc] text-[#145f59] focus:ring-[#145f59] cursor-pointer" />
                        <span className="text-sm text-ink dark:text-[#e2e8f0]">
                          I agree to the <a href="#terms" className="text-[#145f59] dark:text-[#5bbfb5] font-semibold hover:underline">Terms & Conditions</a> of ASSelf vendor partnership program.
                        </span>
                      </label>
                      {errors.terms_accepted && <p className="text-rose-500 text-xs mt-2 ml-8">{errors.terms_accepted}</p>}
                    </div>

                    <button type="submit" disabled={sending} className="w-full py-3.5 px-6 border-none rounded-[14px] bg-[linear-gradient(135deg,#145f59,#1a7a72)] text-white font-poppins text-[15px] font-semibold cursor-pointer shadow-[0_8px_24px_rgba(20,95,89,0.25)] transition-[transform,box-shadow] duration-[180ms] flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(20,95,89,0.35)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                      {sending ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">send</span>
                          Submit Enquiry
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Terms & Conditions Section */}
            <div id="terms" className="mt-10 bg-white dark:bg-[#182226] rounded-[20px] px-7 py-8 md:px-9 md:py-10 shadow-[0_4px_24px_rgba(12,35,38,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border border-black/[0.04] dark:border-white/[0.06]">
              <h2 className="font-poppins text-xl font-bold text-ink dark:text-[#e2e8f0] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#145f59]">gavel</span>
                Terms & Conditions
              </h2>
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>• Valid driving license required for self-drive rentals.</p>
                <p>• Vehicle is for personal use only. Commercial, public or rental use prohibited.</p>
                <p>• No illegal activities, off-road driving, or racing allowed.</p>
                <p>• Renter is liable for all traffic fines and violations.</p>
                <p>• Renter responsible for damages due to negligence or reckless driving.</p>
                <p>• In case of breakdown or accident, inform company immediately.</p>
                <p>• Damages not covered by insurance must be paid by renter.</p>
                <p>• In case of damage or accident, rental charges apply for repair.</p>
                <p>• If renter fails to pay dues, company may recover via security cheque.</p>
                <p>• If renter is unreachable after accident, company may use security cheque.</p>
                <p>• Extension/cancellation must be informed 24 hrs prior. Late penalty: NPR 500/hour.</p>
                <p>• NPR 1,000 cleaning fee applies for excessively dirty vehicle.</p>
                <p>• Advance payment confirms booking. Cancellation charges apply.</p>
                <p>• Vehicle must be returned with same fuel level; otherwise charges apply.</p>
                <p>• Vehicle must be returned by 7:00 PM. Late fee: NPR 800/hour.</p>
                <p>• Next day processing at 7:00 AM.</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
