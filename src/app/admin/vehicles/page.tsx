'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const STATUS_OPTIONS = ['available', 'maintenance', 'inactive'];
const CATEGORY_OPTIONS: string[] = []; // Dynamic — derived from existing vehicles
const FUEL_OPTIONS = ['Petrol', 'Diesel', 'Electric'];
const fmtNpr = (v: number) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDt = (v: string) => v ? new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const vTitle = (v: any) => { const b = (v.brand || '').trim(); const n = (v.name || '').trim(); if (!b || b.toLowerCase() === 'general' || n.toLowerCase().startsWith(b.toLowerCase())) return n || b || 'Vehicle'; return `${b} ${n}`; };

const statusCls = (s: string) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  const l = String(s || '').toLowerCase();
  if (l === 'available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (l === 'inactive' || l === 'unavailable' || l === 'rented') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (l === 'maintenance') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
};

const Field = ({ label, value }: { label: string, value: string }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || <span className="text-slate-400 italic">Not set</span>}</p>
  </article>
);

const EMPTY_FORM = { name: '', brand: '', type: '', category: '', status: 'available', price_per_day: '', fuel_type: 'Petrol', transmission: 'Automatic', seats: 5, vehicle_number: '', location: '', is_active: true, is_top_rented: false, features: ['AC', 'Bluetooth', 'USB Charging'], what_is_included: ['Insurance Coverage', 'Roadside Assistance', 'GPS Navigation', 'Free Cancellation (24h)'] };

export default function AdminVehicles() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [detailVehicle, setDetailVehicle] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  const [newIncludedItem, setNewIncludedItem] = useState('');
  const [vehicleImages, setVehicleImages] = useState<any[]>([]);
  const [pendingImages, setPendingImages] = useState<any[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const perPage = 8;

  const createPreviewUrl = (file: File) => URL.createObjectURL(file);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*, vehicle_images(*)').order('created_at', { ascending: false });
    setVehicles(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchVehicles(); }, []);

  // Auto-open vehicle detail when ?detail=id is present (from global search)
  useEffect(() => {
    const detailId = searchParams?.get('detail');
    if (detailId && vehicles.length > 0) {
      const found = vehicles.find((v: any) => v.id === detailId);
      if (found) setDetailVehicle(found);
    }
  }, [searchParams, vehicles]);

  const fetchVehicleImages = async (vehicleId: string) => {
    const { data } = await supabase.from('vehicle_images').select('*').eq('vehicle_id', vehicleId).order('sort_order');
    setVehicleImages(data || []);
    const primaryIdx = (data || []).findIndex((img: any) => img.is_primary);
    setPrimaryImageIndex(primaryIdx >= 0 ? primaryIdx : 0);
  };

  const uploadVehicleImage = async (file: File, vehicleId: string) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const fileName = `${vehicleId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `vehicles/${fileName}`;
    
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { 
      upsert: true, 
      contentType: file.type 
    });
    if (error) throw error;
    
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const savedCount = editVehicle?.id ? vehicleImages.length : 0;
    const currentTotal = savedCount + pendingImages.length;
    const remainingSlots = 5 - currentTotal;
    
    if (remainingSlots <= 0) {
      toast.warning('Maximum 5 images allowed. Please delete some images first.');
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`Only ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} remaining. First ${remainingSlots} images were selected.`);
    }
    
    if (editVehicle?.id) {
      setUploadingImage(true);
      try {
        for (const file of filesToAdd) {
          const url = await uploadVehicleImage(file, editVehicle.id);
          const isPrimary = vehicleImages.length === 0 && pendingImages.length === 0;
          const { data, error } = await supabase.from('vehicle_images').insert({
            vehicle_id: editVehicle.id,
            url,
            is_primary: isPrimary,
            sort_order: vehicleImages.length + pendingImages.length
          }).select().single();
          
          if (error) throw error;
          setVehicleImages(prev => [...prev, data]);
        }
        await fetchVehicles();
      } catch (err: any) {
        toast.error('Failed to upload image: ' + err.message);
      } finally {
        setUploadingImage(false);
      }
    } else {
      const newPending = filesToAdd.map((file, idx) => ({
        id: `pending-${Date.now()}-${idx}`,
        file,
        previewUrl: createPreviewUrl(file),
        isPrimary: pendingImages.length + idx === 0
      }));
      setPendingImages(prev => [...prev, ...newPending]);
    }
  };

  const removePendingImage = (pendingId: string) => {
    setPendingImages(prev => {
      const filtered = prev.filter(img => img.id !== pendingId);
      const newPrimaryIdx = filtered.findIndex(img => img.isPrimary);
      if (newPrimaryIdx === -1 && filtered.length > 0) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const setPendingImageAsPrimary = (index: number) => {
    setPendingImages(prev => prev.map((img, idx) => ({ ...img, isPrimary: idx === index })));
  };

  const uploadPendingImages = async (vehicleId: string) => {
    if (pendingImages.length === 0) return;
    
    const uploadedImages: any[] = [];
    let primaryImageUrl = null;
    
    for (let i = 0; i < pendingImages.length; i++) {
      const pending = pendingImages[i];
      try {
        const url = await uploadVehicleImage(pending.file, vehicleId);
        const { data, error } = await supabase.from('vehicle_images').insert({
          vehicle_id: vehicleId,
          url,
          is_primary: pending.isPrimary,
          sort_order: i
        }).select().single();
        
        if (!error && data) {
          uploadedImages.push(data);
          if (pending.isPrimary) {
            primaryImageUrl = url;
          }
        }
      } catch (err) {
        console.error('Failed to upload image:', err);
      }
    }
    
    if (primaryImageUrl && vehicleId) {
      await supabase.from('vehicles').update({ primary_image_url: primaryImageUrl }).eq('id', vehicleId);
    }
    
    pendingImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setPendingImages([]);
  };

  // Delete vehicle image
  const deleteVehicleImage = async (imageId: string, index: number) => {
    if (!confirm('Delete this image?')) return;
    try {
      const { error } = await supabase.from('vehicle_images').delete().eq('id', imageId);
      if (error) throw error;
      
      const newImages = vehicleImages.filter((_, i) => i !== index);
      setVehicleImages(newImages);
      
      if (index === primaryImageIndex) {
        setPrimaryImageIndex(newImages.length > 0 ? 0 : -1);
        if (newImages.length > 0) {
          await supabase.from('vehicle_images').update({ is_primary: true }).eq('id', newImages[0].id);
        }
      } else if (index < primaryImageIndex) {
        setPrimaryImageIndex(primaryImageIndex - 1);
      }
      await fetchVehicles();
    } catch (err: any) {
      toast.error('Failed to delete image: ' + err.message);
    }
  };

  // Set image as primary
  const setImageAsPrimary = async (index: number) => {
    const image = vehicleImages[index];
    if (!image || !editVehicle) return;
    
    try {
      await supabase.from('vehicle_images').update({ is_primary: false }).eq('vehicle_id', editVehicle.id);
      await supabase.from('vehicle_images').update({ is_primary: true }).eq('id', image.id);
      await supabase.from('vehicles').update({ primary_image_url: image.url }).eq('id', editVehicle.id);
      
      setPrimaryImageIndex(index);
      await fetchVehicles();
    } catch (err: any) {
      toast.error('Failed to set primary image: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vehicleData: any = {
        name: form.name,
        brand: form.brand,
        type: form.type,
        category: form.category,
        status: form.status,
        price_per_day: Number(form.price_per_day) || 0,
        fuel_type: form.fuel_type,
        transmission: form.transmission,
        seats: Number(form.seats) || 5,
        vehicle_number: form.vehicle_number,
        location: form.location,
        is_active: form.is_active,
        is_top_rented: form.is_top_rented,
        features: form.features,
        what_is_included: form.what_is_included
      };

      let vehicleId: string;
      if (editVehicle?.id) {
        const { data, error } = await supabase.from('vehicles').update(vehicleData).eq('id', editVehicle.id).select().single();
        if (error) {
          console.error('Vehicle update error:', error);
          throw error;
        }
        vehicleId = data.id;
      } else {
        const { data, error } = await supabase.from('vehicles').insert(vehicleData).select().single();
        if (error) {
          console.error('Vehicle insert error:', error);
          throw error;
        }
        vehicleId = data.id;
        await uploadPendingImages(vehicleId);
      }

      setShowForm(false);
      setEditVehicle(null);
      setForm(EMPTY_FORM);
      setPendingImages([]);
      await fetchVehicles();
      toast.success('Vehicle saved successfully!');
    } catch (err: any) {
      toast.error('Failed to save vehicle: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (v: any) => {
    setEditVehicle(v);
    setForm({
      name: v.name || '',
      brand: v.brand || '',
      type: v.type || '',
      category: v.category || '',
      status: v.status || 'available',
      price_per_day: v.price_per_day || '',
      fuel_type: v.fuel_type || 'Petrol',
      transmission: v.transmission || 'Automatic',
      seats: v.seats || 5,
      vehicle_number: v.vehicle_number || '',
      location: v.location || '',
      available: undefined,
      is_active: v.is_active !== false,
      is_top_rented: v.is_top_rented || false,
      features: v.features || ['AC', 'Bluetooth', 'USB Charging'],
      what_is_included: v.what_is_included || ['Insurance Coverage', 'Roadside Assistance', 'GPS Navigation', 'Free Cancellation (24h)']
    });
    fetchVehicleImages(v.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vehicle?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    await fetchVehicles();
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setForm({ ...form, features: [...form.features, newFeature.trim()] });
      setNewFeature('');
    }
  };

  const removeFeature = (idx: number) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== idx) });
  };

  const addIncludedItem = () => {
    if (newIncludedItem.trim()) {
      setForm({ ...form, what_is_included: [...form.what_is_included, newIncludedItem.trim()] });
      setNewIncludedItem('');
    }
  };

  const removeIncludedItem = (idx: number) => {
    setForm({ ...form, what_is_included: form.what_is_included.filter((_, i) => i !== idx) });
  };

  const filtered = vehicles.filter((v: any) => {
    const q = search.toLowerCase();
    return !q || [v.name, v.brand, v.category, v.vehicle_number].some((f) => String(f || '').toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-white';

  // Get all images for a vehicle
  const getVehicleImages = (v: any) => {
    const images: string[] = [];
    if (v.vehicle_images && v.vehicle_images.length > 0) {
      v.vehicle_images.forEach((img: any) => images.push(img.url));
    }
    if (v.primary_image_url && !images.includes(v.primary_image_url)) {
      images.unshift(v.primary_image_url);
    }
    if (v.image_url && !images.includes(v.image_url)) {
      images.push(v.image_url);
    }
    return images;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-10 w-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>;
  }

  /* ─── Detail Page ─── */
  if (detailVehicle) {
    const v = detailVehicle;
    const imgs = getVehicleImages(v);
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setDetailVehicle(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">west</span> Back
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Operations &rsaquo; Vehicles</p>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{vTitle(v)}</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusCls(v.status)}>{v.status || 'Available'}</span>
            <button onClick={() => handleEdit(v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">edit</span> Edit
            </button>
            <button onClick={() => handleDelete(v.id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">
              <span className="material-symbols-outlined text-[16px]">delete</span> Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Main */}
          <div className="space-y-4 xl:col-span-2">
            <article className={`${panel} p-4 sm:p-5`}>
              <div className="flex flex-wrap gap-4">
                {imgs.length > 0 ? (
                  <div className="w-full max-w-xs space-y-2">
                    <img src={imgs[0]} alt={v.name} className="h-44 w-full rounded-2xl object-cover ring-1 ring-black/10 dark:ring-white/10" />
                    {imgs.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {imgs.slice(1, 5).map((url, i) => (
                          <img key={i} src={url} alt={`img ${i + 2}`} className="h-16 w-full rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-44 w-full max-w-xs items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 dark:bg-white/5">No image</div>
                )}
                <div className="min-w-0 flex-1 space-y-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle ID</p><p className="mt-0.5 break-all font-mono text-xs text-slate-600 dark:text-slate-300">{v.id || <span className="text-slate-400">Not set</span>}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle Number</p><p className="mt-0.5 font-mono text-sm font-bold tracking-wider text-slate-800 dark:text-slate-100">{v.vehicle_number || <span className="text-slate-400 italic">Not set</span>}</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Brand" value={v.brand} />
                    <Field label="Category" value={v.category} />
                    <Field label="Transmission" value={v.transmission} />
                    <Field label="Fuel Type" value={v.fuel_type} />
                    <Field label="Seats" value={String(v.seats || 5)} />
                  </div>
                </div>
              </div>
            </article>
            <article className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-sm font-extrabold">Pricing</h4>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Daily Rate" value={fmtNpr(v.price_per_day || v.daily)} />
                <Field label="Weekly Rate" value={fmtNpr(v.weekly)} />
                <Field label="Seasonal Rate" value={fmtNpr(v.seasonal)} />
              </div>
            </article>
            <article className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-2 text-sm font-extrabold">Features</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{Array.isArray(v.features) && v.features.length ? v.features.join(', ') : 'No features listed.'}</p>
            </article>
          </div>
          {/* Sidebar */}
          <aside className="space-y-4">
            <article className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-sm font-extrabold">Status &amp; Availability</h4>
              <div className="space-y-2">
                <Field label="Status" value={v.status} />
                <Field label="Available" value={v.available !== false ? 'Yes' : 'No'} />
                <Field label="Active" value={v.is_active !== false ? 'Yes' : 'No'} />
                <Field label="Location" value={v.location} />
              </div>
            </article>
            <article className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-sm font-extrabold">Timeline</h4>
              <div className="space-y-2">
                <Field label="Added" value={fmtDt(v.created_at)} />
                <Field label="Last Updated" value={fmtDt(v.updated_at)} />
              </div>
            </article>
            <article className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-sm font-extrabold">Images ({imgs.length} / 5)</h4>
              <div className="grid grid-cols-2 gap-2">
                {imgs.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt={`img ${i + 1}`} className={`w-full rounded-xl object-cover ${i === 0 ? 'col-span-2 h-36' : 'h-20'}`} />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-[#1f7668] px-2 py-0.5 text-[10px] font-bold text-white">Main</span>}
                  </div>
                ))}
                {!imgs.length && <p className="col-span-2 text-[11px] text-slate-400">No images</p>}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Use Edit to add, replace or remove images.</p>
            </article>
          </aside>
        </div>

        {/* Edit drawer (can open from detail) */}
        {showForm && renderDrawer()}
      </div>
    );
  }

  /* ─── Edit / Add Drawer ─── */
  function renderDrawer() {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)}></div>
        <div className="relative w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#1a2228]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold">{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-xs font-semibold">Vehicle Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="Enter vehicle name" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Brand</span><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inp} /></label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-xs font-semibold">Type</span><input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inp} placeholder="sedan" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Category</span>
                <input list="category-options" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp} placeholder="e.g. SUV, Sedan, Van..." />
                <datalist id="category-options">
                  {[...new Set(vehicles.map((v: any) => v.category).filter(Boolean))].sort().map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block space-y-1"><span className="text-xs font-semibold">Seats</span><input type="number" min="1" max="15" value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} className={inp} /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Transmission</span><input value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} className={inp} /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Fuel Type</span>
                <select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} className={inp}>{FUEL_OPTIONS.map((f) => <option key={f}>{f}</option>)}</select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block space-y-1"><span className="text-xs font-semibold">Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inp}>{STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Price Per Day</span><input type="number" min="1" value={form.price_per_day} onChange={(e) => setForm({ ...form, price_per_day: e.target.value })} className={inp} /></label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-xs font-semibold">Vehicle Number (Plate)</span><input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} className={inp} placeholder="e.g., BA 1 PA 1234" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold">Current Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inp} placeholder="e.g., Banasthali, Kathmandu" /></label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span className="text-xs font-semibold">Is Active (currently on a trip)</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#1f7668]" checked={form.is_top_rented} onChange={(e) => setForm({ ...form, is_top_rented: e.target.checked })} /><span className="text-xs font-semibold">⭐ Top Rented (show on homepage)</span></label>
            </div>

            {/* Features Section */}
            <div className={`${panel} p-4`}>
              <h4 className="text-sm font-extrabold mb-3">Vehicle Features</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.features || []).map((feature, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-xs font-semibold text-[#2d5759]">
                    {feature}
                    <button type="button" onClick={() => removeFeature(idx)} className="text-[#2d5759] hover:text-rose-600">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="Add new feature..." className={`${inp} flex-1`} />
                <button type="button" onClick={addFeature} className="rounded-lg bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#185f54]">Add</button>
              </div>
            </div>

            {/* What Is Included Section */}
            <div className={`${panel} p-4`}>
              <h4 className="text-sm font-extrabold mb-3">What Is Included</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.what_is_included || []).map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-xs font-semibold text-[#2d5759]">
                    {item}
                    <button type="button" onClick={() => removeIncludedItem(idx)} className="text-[#2d5759] hover:text-rose-600">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newIncludedItem} onChange={(e) => setNewIncludedItem(e.target.value)} placeholder="Add included item..." className={`${inp} flex-1`} />
                <button type="button" onClick={addIncludedItem} className="rounded-lg bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#185f54]">Add</button>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className={`${panel} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-extrabold">
                  Vehicle Images ({(editVehicle ? vehicleImages.length : 0) + pendingImages.length} / 5)
                  {pendingImages.length > 0 && <span className="ml-2 text-xs font-normal text-amber-600">({pendingImages.length} pending upload)</span>}
                </h4>
                {(editVehicle ? vehicleImages.length : 0) + pendingImages.length < 5 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="rounded-lg bg-[#1f7668] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">
                    {uploadingImage ? 'Uploading...' : `+ Select Images`}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageFileSelect} />
              
              {(editVehicle && vehicleImages.length === 0 && pendingImages.length === 0) || (!editVehicle && pendingImages.length === 0) ? (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/5">
                  <span className="material-symbols-outlined text-3xl text-slate-400">image</span>
                  <p className="mt-2 text-sm text-slate-500">No images selected yet</p>
                  <p className="text-xs text-slate-400">Click &quot;Select Images&quot; to upload up to 5 photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {/* Show saved images when editing */}
                  {editVehicle && vehicleImages.map((img, i) => (
                    <div key={img.id} className="group relative">
                      <img src={img.url} alt={`Vehicle ${i + 1}`} className="h-24 w-full rounded-xl object-cover" />
                      {i === primaryImageIndex && (
                        <span className="absolute left-1 top-1 rounded-full bg-[#1f7668] px-2 py-0.5 text-[10px] font-bold text-white">Main</span>
                      )}
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {i !== primaryImageIndex && (
                          <button type="button" onClick={() => setImageAsPrimary(i)} title="Set as main image" className="rounded-full bg-emerald-500 p-1 text-white shadow hover:bg-emerald-600">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          </button>
                        )}
                        <button type="button" onClick={() => deleteVehicleImage(img.id, i)} title="Delete image" className="rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show pending images */}
                  {pendingImages.map((img, i) => (
                    <div key={img.id} className="group relative">
                      <img src={img.previewUrl} alt={`Pending ${i + 1}`} className="h-24 w-full rounded-xl object-cover opacity-80" />
                      <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Pending</span>
                      {img.isPrimary && (
                        <span className="absolute right-1 bottom-1 rounded-full bg-[#1f7668] px-2 py-0.5 text-[10px] font-bold text-white">Main</span>
                      )}
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {!img.isPrimary && (
                          <button type="button" onClick={() => setPendingImageAsPrimary(i)} title="Set as main image" className="rounded-full bg-emerald-500 p-1 text-white shadow hover:bg-emerald-600">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          </button>
                        )}
                        <button type="button" onClick={() => removePendingImage(img.id)} title="Delete image" className="rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="mt-2 text-xs text-slate-400">
                {(() => {
                  const total = (editVehicle ? vehicleImages.length : 0) + pendingImages.length;
                  const remaining = 5 - total;
                  if (remaining > 0) return `Can select ${remaining} more image${remaining === 1 ? '' : 's'}`;
                  return 'Maximum images reached';
                })()}
              </p>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">{saving ? 'Saving…' : editVehicle ? 'Save Changes' : 'Add Vehicle'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
          <h2 className={heading}>Vehicle Management</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchVehicles} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
          <button onClick={() => { setEditVehicle(null); setForm(EMPTY_FORM); setPendingImages([]); setVehicleImages([]); setPrimaryImageIndex(-1); setShowForm(true); }} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">+ Add Vehicle</button>
        </div>
      </header>

      <div className={`${panel} p-4`}>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Filter vehicles by name, brand, status…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
      </div>

      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className="mb-3 text-base font-extrabold">Vehicle Inventory</h3>
        {paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No vehicles found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">Vehicle</th><th className="pb-2 pr-3">Number</th><th className="pb-2 pr-3">Category</th><th className="pb-2 pr-3">Specs</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Price/Day</th><th className="pb-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        {v.primary_image_url || v.image_url ? (
                          <img src={v.primary_image_url || v.image_url} alt="" className="h-10 w-14 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">image_not_supported</span>
                          </div>
                        )}
                        <div>
                          <button onClick={() => setDetailVehicle(v)} className="font-bold text-slate-900 hover:text-[#1f7668] hover:underline dark:text-white dark:hover:text-emerald-300">{v.name}</button>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{v.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs font-mono text-slate-600 dark:text-slate-300">{v.vehicle_number || <span className="text-slate-400 italic">Not set</span>}</td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{v.category}</td>
                    <td className="py-3 pr-3 text-xs text-slate-500 dark:text-slate-400">{v.fuel_type} · {v.transmission} · {v.seats} seats</td>
                    <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={v.status || 'available'}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          await supabase.from('vehicles').update({ status: newStatus }).eq('id', v.id);
                          toast.success(`Status changed to ${newStatus}`);
                          fetchVehicles();
                        }}
                        className={`${statusCls(v.status)} border-0 outline-none cursor-pointer appearance-none pr-5 bg-[length:16px] bg-[right_4px_center] bg-no-repeat`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")` }}
                      >
                        <option value="available">available</option>
                        <option value="maintenance">maintenance</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 font-semibold">{fmtNpr(v.price_per_day)}</td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                      <button onClick={() => setDetailVehicle(v)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200" title="View">
                        <span className="material-symbols-outlined text-[14px] align-middle">visibility</span>
                      </button>
                      <button onClick={() => handleEdit(v)} className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200" title="Edit">
                        <span className="material-symbols-outlined text-[14px] align-middle">edit</span>
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="ml-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400" title="Delete">
                        <span className="material-symbols-outlined text-[14px] align-middle">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filtered.length} vehicles • Page {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
            </div>
          </div>
        )}
      </section>

      {showForm && renderDrawer()}
    </div>
  );
}
