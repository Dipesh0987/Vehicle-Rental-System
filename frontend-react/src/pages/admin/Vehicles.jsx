import { useState, useEffect, useRef } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const STATUS_OPTIONS = ['available', 'maintenance', 'inactive'];
const CATEGORY_OPTIONS = ['SUV', 'Sedan', 'Bike', 'Electric', 'Luxury', 'Hatchback', 'Van'];
const FUEL_OPTIONS = ['Petrol', 'Diesel', 'Electric'];
const fmtNpr = (v) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDt = (v) => v ? new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const vTitle = (v) => { const b = (v.brand || '').trim(); const n = (v.name || '').trim(); if (!b || b.toLowerCase() === 'general' || n.toLowerCase().startsWith(b.toLowerCase())) return n || b || 'Vehicle'; return `${b} ${n}`; };

const statusCls = (s) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  const l = String(s || '').toLowerCase();
  if (l === 'available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (l === 'inactive' || l === 'unavailable' || l === 'rented') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (l === 'maintenance') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
};

const Field = ({ label, value }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || <span className="text-slate-400 italic">Not set</span>}</p>
  </article>
);

const EMPTY_FORM = { name: '', brand: '', type: '', category: 'SUV', status: 'available', price_per_day: '', fuel_type: 'Petrol', transmission: 'Automatic', seats: 5, vehicle_number: '', location: '', available: true, is_active: true, features: ['AC', 'Bluetooth', 'USB Charging'], what_is_included: ['Insurance Coverage', 'Roadside Assistance', 'GPS Navigation', 'Free Cancellation (24h)'] };

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Features and included items management
  const [newFeature, setNewFeature] = useState('');
  const [newIncludedItem, setNewIncludedItem] = useState('');
  // Image management states
  const [vehicleImages, setVehicleImages] = useState([]); // Already saved images (for edit mode)
  const [pendingImages, setPendingImages] = useState([]); // Images selected but not yet uploaded (for add mode)
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const perPage = 8;

  // Create preview URL for a file
  const createPreviewUrl = (file) => URL.createObjectURL(file);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*, vehicle_images(*)').order('created_at', { ascending: false });
    setVehicles(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchVehicles(); }, []);

  // Fetch vehicle images when editing
  const fetchVehicleImages = async (vehicleId) => {
    const { data } = await supabase.from('vehicle_images').select('*').eq('vehicle_id', vehicleId).order('sort_order');
    setVehicleImages(data || []);
    // Find primary image index
    const primaryIdx = (data || []).findIndex(img => img.is_primary);
    setPrimaryImageIndex(primaryIdx >= 0 ? primaryIdx : 0);
  };

  // Upload image to storage
  const uploadVehicleImage = async (file, vehicleId) => {
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

  // Handle file selection for images (multiple files supported)
  const handleImageFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Calculate current total differently for add vs edit mode
    const savedCount = editVehicle?.id ? vehicleImages.length : 0;
    const currentTotal = savedCount + pendingImages.length;
    const remainingSlots = 5 - currentTotal;
    
    if (remainingSlots <= 0) {
      alert('Maximum 5 images allowed. Please delete some images first.');
      return;
    }
    
    // Only take as many files as we have slots for
    const filesToAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Only ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} remaining. First ${remainingSlots} images were selected.`);
    }
    
    // If editing existing vehicle, upload immediately
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
        await fetchVehicles(); // Refresh to update primary_image_url
      } catch (err) {
        alert('Failed to upload image: ' + err.message);
      } finally {
        setUploadingImage(false);
      }
    } else {
      // For new vehicles, store files temporarily and show previews
      const newPending = filesToAdd.map((file, idx) => ({
        id: `pending-${Date.now()}-${idx}`,
        file,
        previewUrl: createPreviewUrl(file),
        isPrimary: pendingImages.length + idx === 0
      }));
      setPendingImages(prev => [...prev, ...newPending]);
    }
  };

  // Remove a pending image (before vehicle is saved)
  const removePendingImage = (pendingId) => {
    setPendingImages(prev => {
      const filtered = prev.filter(img => img.id !== pendingId);
      // Update primary index if needed
      const newPrimaryIdx = filtered.findIndex(img => img.isPrimary);
      if (newPrimaryIdx === -1 && filtered.length > 0) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  // Set a pending image as primary
  const setPendingImageAsPrimary = (index) => {
    setPendingImages(prev => prev.map((img, idx) => ({ ...img, isPrimary: idx === index })));
  };

  // Upload pending images after vehicle is created
  const uploadPendingImages = async (vehicleId) => {
    if (pendingImages.length === 0) return;
    
    const uploadedImages = [];
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
          // Track the primary image URL
          if (pending.isPrimary) {
            primaryImageUrl = url;
          }
        }
      } catch (err) {
        console.error('Failed to upload image:', err);
      }
    }
    
    // Update vehicle's primary_image_url if we have a primary image
    if (primaryImageUrl && vehicleId) {
      await supabase.from('vehicles').update({ primary_image_url: primaryImageUrl }).eq('id', vehicleId);
    }
    
    // Clear pending images and revoke preview URLs
    pendingImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setPendingImages([]);
    
    return uploadedImages;
  };

  // Delete vehicle image
  const deleteVehicleImage = async (imageId, index) => {
    if (!confirm('Delete this image?')) return;
    try {
      const { error } = await supabase.from('vehicle_images').delete().eq('id', imageId);
      if (error) throw error;
      
      const newImages = vehicleImages.filter((_, i) => i !== index);
      setVehicleImages(newImages);
      
      // Update primary index if needed
      if (index === primaryImageIndex) {
        setPrimaryImageIndex(newImages.length > 0 ? 0 : -1);
        // Set first remaining image as primary
        if (newImages.length > 0) {
          await supabase.from('vehicle_images').update({ is_primary: true }).eq('id', newImages[0].id);
        }
      } else if (index < primaryImageIndex) {
        setPrimaryImageIndex(primaryImageIndex - 1);
      }
      await fetchVehicles();
    } catch (err) {
      alert('Failed to delete image: ' + err.message);
    }
  };

  // Set image as primary
  const setImageAsPrimary = async (index) => {
    const image = vehicleImages[index];
    if (!image) return;
    
    try {
      // Unset current primary
      await supabase.from('vehicle_images').update({ is_primary: false }).eq('vehicle_id', editVehicle.id);
      // Set new primary
      await supabase.from('vehicle_images').update({ is_primary: true }).eq('id', image.id);
      
      // Update vehicle's primary_image_url
      await supabase.from('vehicles').update({ primary_image_url: image.url }).eq('id', editVehicle.id);
      
      setPrimaryImageIndex(index);
      await fetchVehicles();
    } catch (err) {
      alert('Failed to set primary image: ' + err.message);
    }
  };

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    return !q || [v.name, v.brand, v.category, v.status, v.vehicle_number, v.fuel_type].some((f) => String(f || '').toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openEdit = (v) => {
    setEditVehicle(v);
    // Helper to get defaults if array is empty/null
    const getFeatures = (f) => (Array.isArray(f) && f.length > 0) ? f : ['AC', 'Bluetooth', 'USB Charging'];
    const getIncluded = (i) => (Array.isArray(i) && i.length > 0) ? i : ['Insurance Coverage', 'Roadside Assistance', 'GPS Navigation', 'Free Cancellation (24h)'];
    
    setForm({ 
      name: v.name || '', 
      brand: v.brand || '', 
      type: v.type || v.category || 'sedan', 
      category: v.category || 'SUV', 
      status: v.status || 'available', 
      price_per_day: v.price_per_day || '', 
      fuel_type: v.fuel_type || 'Petrol', 
      transmission: v.transmission || 'Automatic', 
      seats: v.seats || 5, 
      vehicle_number: v.vehicle_number || '', 
      location: v.location || '', 
      available: v.available !== false, 
      is_active: v.is_active !== false, 
      features: getFeatures(v.features), 
      what_is_included: getIncluded(v.what_is_included)
    });
    // Reset add item states
    setNewFeature('');
    setNewIncludedItem('');
    // Load vehicle images
    fetchVehicleImages(v.id);
    setShowForm(true);
  };
  const openAdd = () => { 
    setEditVehicle(null); 
    setForm(EMPTY_FORM); 
    setNewFeature('');
    setNewIncludedItem('');
    setVehicleImages([]);
    setPendingImages([]);
    setPrimaryImageIndex(-1);
    setShowForm(true); 
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, price_per_day: Number(form.price_per_day) || 0, seats: Number(form.seats) || 5 };
      let vehicleId = editVehicle?.id;
      
      if (editVehicle) {
        await supabase.from('vehicles').update(payload).eq('id', editVehicle.id);
      } else {
        const { data } = await supabase.from('vehicles').insert(payload).select().single();
        vehicleId = data?.id;
        
        // Upload pending images for new vehicle
        if (vehicleId && pendingImages.length > 0) {
          await uploadPendingImages(vehicleId);
        }
      }
      
      // Clean up any remaining pending image previews
      pendingImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setPendingImages([]);
      
      setShowForm(false); 
      setVehicleImages([]);
      setPrimaryImageIndex(-1);
      await fetchVehicles();
    } catch (err) {
      console.error('Save error:', err);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this vehicle?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    if (detailVehicle?.id === id) setDetailVehicle(null);
    await fetchVehicles();
  };

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-white';

  // Get all images for a vehicle including from vehicle_images table
  const getVehicleImages = (v) => {
    const images = [];
    if (v.vehicle_images && v.vehicle_images.length > 0) {
      v.vehicle_images.forEach(img => images.push(img.url));
    }
    if (v.primary_image_url && !images.includes(v.primary_image_url)) {
      images.unshift(v.primary_image_url);
    }
    if (v.image_url && !images.includes(v.image_url)) {
      images.push(v.image_url);
    }
    return images;
  };

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
            <button onClick={() => openEdit(v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
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
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp}>{CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
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
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /><span className="text-xs font-semibold">Available</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span className="text-xs font-semibold">Is Active</span></label>
            </div>

            {/* Features Section */}
            <div className={`${panel} p-4`}>
              <h4 className="text-sm font-extrabold mb-3">Vehicle Features</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.features || []).map((feature, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-xs font-semibold text-[#2d5759]">
                    {feature}
                    <button type="button" onClick={() => setForm({ ...form, features: (form.features || []).filter((_, i) => i !== idx) })} className="text-[#2d5759] hover:text-rose-600">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="Add new feature..." className={`${inp} flex-1`} />
                <button type="button" onClick={() => { if (newFeature.trim()) { setForm({ ...form, features: [...(form.features || []), newFeature.trim()] }); setNewFeature(''); } }} className="rounded-lg bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#185f54]">Add</button>
              </div>
            </div>

            {/* What Is Included Section */}
            <div className={`${panel} p-4`}>
              <h4 className="text-sm font-extrabold mb-3">What Is Included</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.what_is_included || []).map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-xs font-semibold text-[#2d5759]">
                    {item}
                    <button type="button" onClick={() => setForm({ ...form, what_is_included: (form.what_is_included || []).filter((_, i) => i !== idx) })} className="text-[#2d5759] hover:text-rose-600">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newIncludedItem} onChange={(e) => setNewIncludedItem(e.target.value)} placeholder="Add included item..." className={`${inp} flex-1`} />
                <button type="button" onClick={() => { if (newIncludedItem.trim()) { setForm({ ...form, what_is_included: [...(form.what_is_included || []), newIncludedItem.trim()] }); setNewIncludedItem(''); } }} className="rounded-lg bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#185f54]">Add</button>
              </div>
            </div>

            {/* Image Upload Section - Works for both Add and Edit modes */}
            <div className={`${panel} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-extrabold">
                  Vehicle Images ({(editVehicle ? vehicleImages.length : 0) + pendingImages.length} / 5)
                  {pendingImages.length > 0 && <span className="ml-2 text-xs font-normal text-amber-600">({pendingImages.length} pending upload)</span>}
                </h4>
                {(editVehicle ? vehicleImages.length : 0) + pendingImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="rounded-lg bg-[#1f7668] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
                  >
                    {uploadingImage ? 'Uploading...' : `+ Select ${5 - ((editVehicle ? vehicleImages.length : 0) + pendingImages.length) > 1 ? 'Images' : 'Image'}`}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageFileSelect}
              />
              
              {/* Combined grid showing both saved and pending images */}
              {(editVehicle && vehicleImages.length === 0 && pendingImages.length === 0) || (!editVehicle && pendingImages.length === 0) ? (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/5">
                  <span className="material-symbols-outlined text-3xl text-slate-400">image</span>
                  <p className="mt-2 text-sm text-slate-500">No images selected yet</p>
                  <p className="text-xs text-slate-400">Click "Select Images" to upload up to 5 photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {/* Show saved images when editing */}
                  {editVehicle && vehicleImages.map((img, i) => (
                    <div key={img.id} className="group relative">
                      <img src={img.url} alt={`Vehicle ${i + 1}`} className="h-24 w-full rounded-xl object-cover" />
                      {i === primaryImageIndex && (
                        <span className="absolute left-1 top-1 rounded-full bg-[#1f7668] px-2 py-0.5 text-[10px] font-bold text-white">
                          Main
                        </span>
                      )}
                      {/* Image Actions */}
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {i !== primaryImageIndex && (
                          <button
                            type="button"
                            onClick={() => setImageAsPrimary(i)}
                            title="Set as main image"
                            className="rounded-full bg-emerald-500 p-1 text-white shadow hover:bg-emerald-600"
                          >
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteVehicleImage(img.id, i)}
                          title="Delete image"
                          className="rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show pending images */}
                  {pendingImages.map((img, i) => (
                    <div key={img.id} className="group relative">
                      <img src={img.previewUrl} alt={`Pending ${i + 1}`} className="h-24 w-full rounded-xl object-cover opacity-80" />
                      <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        Pending
                      </span>
                      {img.isPrimary && (
                        <span className="absolute right-1 bottom-1 rounded-full bg-[#1f7668] px-2 py-0.5 text-[10px] font-bold text-white">
                          Main
                        </span>
                      )}
                      {/* Pending Image Actions - Always visible like in edit mode */}
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {!img.isPrimary ? (
                          <button
                            type="button"
                            onClick={() => setPendingImageAsPrimary(i)}
                            title="Set as main image"
                            className="rounded-full bg-emerald-500 p-1 text-white shadow hover:bg-emerald-600"
                          >
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removePendingImage(img.id)}
                          title="Delete image"
                          className="rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600"
                        >
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
          <button onClick={openAdd} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">+ Add Vehicle</button>
        </div>
      </header>

      <div className={`${panel} p-4`}>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Filter vehicles by name, brand, status…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
      </div>

      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className="mb-3 text-base font-extrabold">Vehicle Inventory</h3>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading vehicles…</div> : paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No vehicles found.</div> : (
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
                    <td className="py-3 pr-3"><span className={statusCls(v.status)}>{v.status}</span></td>
                    <td className="py-3 pr-3 font-semibold">{fmtNpr(v.price_per_day)}</td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                      <button onClick={() => setDetailVehicle(v)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200" title="View">
                        <span className="material-symbols-outlined text-[14px] align-middle">visibility</span>
                      </button>
                      <button onClick={() => openEdit(v)} className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200" title="Edit">
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
