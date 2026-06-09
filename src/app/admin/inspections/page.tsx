'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { jsPDF } from 'jspdf';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

const conditionColor = (c: string) => {
  if (c === 'good') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  if (c === 'resolved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  if (c === 'in_progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
  if (c === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  if (c === 'minor_damage' || c === 'damaged') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  if (c === 'major_damage') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
  if (c === 'missing') return 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300';
  return 'bg-slate-100 text-slate-600';
};

const conditionLabel = (c: string) => {
  if (c === 'good') return 'Good';
  if (c === 'resolved') return 'Completed';
  if (c === 'in_progress') return 'In Progress';
  if (c === 'pending') return 'Pending';
  if (c === 'minor_damage') return 'Minor Damage';
  if (c === 'major_damage') return 'Major Damage';
  if (c === 'missing') return 'Missing';
  return c;
};

export default function InspectionHistory() {
  const toast = useToast();
  const [inspections, setInspections] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [showDamageInvoice, setShowDamageInvoice] = useState(false);
  const [damageInvoiceData, setDamageInvoiceData] = useState<any>(null);

  useEffect(() => {
    fetchData();

    // Real-time subscription for auto-refresh
    const channel = supabase
      .channel('inspections-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_inspections' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspection_items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: insp }, { data: vehs }] = await Promise.all([
        supabase.from('vehicle_inspections')
          .select('*, inspection_items(*)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('vehicles').select('id, name, brand, vehicle_number').order('name'),
      ]);
      setInspections(insp || []);
      setVehicles(vehs || []);
    } catch (err) {
      console.error('Error loading inspections:', err);
    }
    setLoading(false);
  };

  const generateDamageInvoice = async (inspection: any, damagedItems: any[]) => {
    // Fetch customer details from the booking
    let customerName = '';
    let customerPhone = '';
    let customerEmail = '';
    let bookingCode = '';
    
    if (inspection.booking_id) {
      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select('customer_name, customer_phone, customer_email, booking_code')
          .eq('id', inspection.booking_id)
          .maybeSingle();
        if (booking) {
          customerName = booking.customer_name || '';
          customerPhone = booking.customer_phone || '';
          customerEmail = booking.customer_email || '';
          bookingCode = booking.booking_code || inspection.booking_id.slice(0, 8);
        }
      } catch (err) {
        console.log('Could not fetch booking details:', err);
        bookingCode = inspection.booking_id?.slice(0, 8) || '';
      }
    }

    // Set editable invoice data and open modal
    setDamageInvoiceData({
      invoiceNumber: `DMG-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      date: new Date(inspection.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      vehicleName: getVehicleName(inspection.vehicle_id),
      vehicleNumber: getVehicleNumber(inspection.vehicle_id),
      customerName,
      customerPhone,
      customerEmail,
      bookingCode,
      inspectionType: inspection.inspection_type === 'before_trip' ? 'Before Trip' : 'After Trip',
      items: damagedItems.map((it: any) => ({
        id: it.id || null,
        partName: it.part_name || '',
        condition: conditionLabel(it.condition),
        conditionDb: it.condition,
        description: it.damage_description || '',
        cost: Number(it.repair_cost || 0),
      })),
      notes: inspection.notes || '',
    });
    setShowDamageInvoice(true);
  };

  // Reverse condition label to DB value
  const conditionToDb = (label: string): string => {
    const map: Record<string, string> = {
      'Good': 'good',
      'Minor Damage': 'minor_damage',
      'Major Damage': 'major_damage',
      'Missing': 'missing',
      'Pending': 'pending',
      'In Progress': 'in_progress',
      'Completed': 'resolved',
    };
    return map[label] || label.toLowerCase().replace(/\s+/g, '_');
  };

  // Save all invoice items to the DB (updates existing, inserts new ones)
  const saveInspectionItemsToDb = async (d: any) => {
    if (!selectedInspection?.id) return;
    const dbItems = selectedInspection.inspection_items || [];
    const usedDbIds = new Set<string>();

    for (let i = 0; i < d.items.length; i++) {
      const editedItem = d.items[i];
      // Match by stored ID first, then by part_name, then by index
      let matchingItem = editedItem.id ? dbItems.find((it: any) => it.id === editedItem.id) : null;
      if (!matchingItem) {
        matchingItem = dbItems.find((it: any) => it.part_name === editedItem.partName && !usedDbIds.has(it.id));
      }
      if (!matchingItem && dbItems[i] && !usedDbIds.has(dbItems[i]?.id)) {
        matchingItem = dbItems[i];
      }

      if (matchingItem?.id) {
        // Update existing item
        usedDbIds.add(matchingItem.id);
        await supabase.from('inspection_items').update({
          part_name: editedItem.partName,
          condition: conditionToDb(editedItem.condition),
          damage_description: editedItem.description || null,
          repair_cost: Number(editedItem.cost) || 0,
        }).eq('id', matchingItem.id);
      } else {
        // Insert new item (added from invoice editor)
        await supabase.from('inspection_items').insert({
          inspection_id: selectedInspection.id,
          part_id: `invoice-${Date.now()}-${i}`,
          part_name: editedItem.partName,
          condition: conditionToDb(editedItem.condition),
          damage_description: editedItem.description || null,
          repair_cost: Number(editedItem.cost) || 0,
        });
      }
    }

    // Update notes on the inspection
    await supabase.from('vehicle_inspections').update({
      notes: d.notes || null,
    }).eq('id', selectedInspection.id);
  };

  const downloadDamageInvoicePDF = async () => {
    if (!damageInvoiceData) return;
    const d = damageInvoiceData;

    // Save edited values back to inspection_items in the database
    if (selectedInspection?.id) {
      try {
        await saveInspectionItemsToDb(d);
        toast.success('Changes saved to inspection records!');
        await fetchData();
        const { data: refreshed } = await supabase
          .from('vehicle_inspections')
          .select('*, inspection_items(*)')
          .eq('id', selectedInspection.id)
          .single();
        if (refreshed) setSelectedInspection(refreshed);
      } catch (err: any) {
        console.error('Failed to save edits:', err);
        toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
      }
    }

    // Generate PDF
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 20;
    let y = 18;

    // Company header
    doc.setFontSize(18);
    doc.setTextColor(20, 95, 89);
    doc.text('ASSELF DRIVE', pw / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Banasthali, Kathmandu, Nepal | +977 970-452-0781 | info@asselfdrive.com', pw / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(20, 95, 89); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 8;

    // Title
    doc.setFontSize(13);
    doc.setTextColor(180, 30, 30);
    doc.text('VEHICLE DAMAGE INVOICE', pw / 2, y, { align: 'center' });
    y += 8;

    // Invoice info
    doc.setFontSize(9); doc.setTextColor(30);
    doc.text(`Invoice #: ${d.invoiceNumber}`, m, y);
    doc.text(`Date: ${d.date}`, pw - m, y, { align: 'right' });
    y += 6;
    doc.text(`Booking Ref: ${d.bookingCode}`, m, y);
    doc.text(`Inspection: ${d.inspectionType}`, pw - m, y, { align: 'right' });
    y += 10;

    // Customer & Vehicle info boxes
    doc.setFillColor(245, 245, 245);
    doc.rect(m, y, (pw - m * 2) / 2 - 3, 22, 'F');
    doc.rect(m + (pw - m * 2) / 2 + 3, y, (pw - m * 2) / 2 - 3, 22, 'F');
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text('CUSTOMER', m + 3, y + 5);
    doc.text('VEHICLE', m + (pw - m * 2) / 2 + 6, y + 5);
    doc.setFontSize(9); doc.setTextColor(30);
    doc.text(d.customerName || 'N/A', m + 3, y + 11);
    doc.text(d.customerPhone || '', m + 3, y + 16);
    doc.text(d.customerEmail || '', m + 3, y + 21);
    doc.text(d.vehicleName, m + (pw - m * 2) / 2 + 6, y + 11);
    doc.text(`No: ${d.vehicleNumber}`, m + (pw - m * 2) / 2 + 6, y + 16);
    y += 28;

    // Table header
    doc.setFillColor(30, 30, 30);
    doc.rect(m, y, pw - m * 2, 7, 'F');
    doc.setFontSize(8); doc.setTextColor(255);
    doc.text('S.N', m + 3, y + 5);
    doc.text('Part', m + 12, y + 5);
    doc.text('Condition', m + 70, y + 5);
    doc.text('Description', m + 100, y + 5);
    doc.text('Cost (NPR)', pw - m - 3, y + 5, { align: 'right' });
    y += 9;

    // Items
    let total = 0;
    doc.setTextColor(30);
    d.items.forEach((item: any, i: number) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.text(`${i + 1}`, m + 3, y + 4);
      doc.text(item.partName, m + 12, y + 4);
      doc.text(item.condition, m + 70, y + 4);
      const desc = doc.splitTextToSize(item.description || '-', 35);
      doc.text(desc[0], m + 100, y + 4);
      doc.text(item.cost.toLocaleString(), pw - m - 3, y + 4, { align: 'right' });
      total += item.cost;
      y += 7;
      doc.setDrawColor(230); doc.line(m, y, pw - m, y); y += 1;
    });

    // Total
    y += 4;
    doc.setFontSize(11); doc.setTextColor(180, 30, 30);
    doc.text(`TOTAL: NPR ${total.toLocaleString()}`, pw - m - 3, y, { align: 'right' });
    y += 10;

    // Notes
    if (d.notes) {
      doc.setFontSize(8); doc.setTextColor(100);
      doc.text(`Notes: ${d.notes}`, m, y);
      y += 8;
    }

    // Footer
    doc.setDrawColor(200); doc.line(m, y, pw - m, y); y += 6;
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text('Generated by ASSelf Drive Vehicle Inspection System', pw / 2, y, { align: 'center' });

    doc.save(`Damage-Invoice-${d.invoiceNumber}.pdf`);
    toast.success('Damage invoice PDF downloaded!');
    setShowDamageInvoice(false);
  };

  const saveInvoiceEditsOnly = async () => {
    if (!damageInvoiceData || !selectedInspection?.id) return;
    const d = damageInvoiceData;
    try {
      await saveInspectionItemsToDb(d);
      toast.success('Invoice edits saved successfully!');
      await fetchData();
      const { data: refreshed } = await supabase
        .from('vehicle_inspections')
        .select('*, inspection_items(*)')
        .eq('id', selectedInspection.id)
        .single();
      if (refreshed) setSelectedInspection(refreshed);
      setShowDamageInvoice(false);
    } catch (err: any) {
      console.error('Failed to save edits:', err);
      toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
    }
  };

  const filtered = useMemo(() => {
    return inspections.filter((i: any) => {
      if (vehicleFilter && i.vehicle_id !== vehicleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const veh = vehicles.find((v: any) => v.id === i.vehicle_id);
        const hay = `${veh?.name || ''} ${veh?.brand || ''} ${veh?.vehicle_number || ''} ${i.inspection_type} ${i.overall_condition}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inspections, vehicleFilter, search, vehicles]);

  const getVehicleName = (vehicleId: string) => {
    const v = vehicles.find((veh: any) => veh.id === vehicleId);
    return v ? `${v.brand || ''} ${v.name}`.trim() : 'Unknown Vehicle';
  };

  const getVehicleNumber = (vehicleId: string) => {
    const v = vehicles.find((veh: any) => veh.id === vehicleId);
    return v?.vehicle_number || '';
  };

  // Compare before and after for same booking
  const getComparison = (inspection: any) => {
    if (inspection.inspection_type !== 'after_trip') return null;
    const beforeInsp = inspections.find((i: any) => 
      i.booking_id === inspection.booking_id && 
      i.inspection_type === 'before_trip' &&
      i.id !== inspection.id
    );
    if (!beforeInsp) return null;
    return beforeInsp;
  };

  if (selectedInspection) {
    const insp = selectedInspection;
    const beforeInsp = getComparison(insp);
    const items = insp.inspection_items || [];
    const damaged = items.filter((it: any) => it.condition !== 'good');

    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setSelectedInspection(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200">
            <span className="material-symbols-outlined text-[16px]">west</span> Back to History
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${insp.inspection_type === 'before_trip' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
            {insp.inspection_type === 'before_trip' ? 'Before Trip' : 'After Trip'}
          </span>
        </header>

        <div className={`${panel} p-5`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Vehicle</p>
              <p className="mt-1 text-sm font-semibold dark:text-white">{getVehicleName(insp.vehicle_id)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Date</p>
              <p className="mt-1 text-sm font-semibold dark:text-white">{new Date(insp.created_at).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Fuel Level</p>
              <p className="mt-1 text-sm font-semibold dark:text-white capitalize">{insp.fuel_level || 'N/A'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</p>
              {damaged.length > 0 ? (
                <select
                  value={insp.overall_condition === 'resolved' ? 'completed' : (insp.overall_condition === 'good' ? 'pending' : (insp.overall_condition || 'pending'))}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const dbCondition = newStatus === 'completed' ? 'resolved' : newStatus;
                    await supabase.from('vehicle_inspections').update({ overall_condition: dbCondition }).eq('id', insp.id);
                    if (newStatus === 'completed') {
                      await supabase.from('vehicles').update({ status: 'available' }).eq('id', insp.vehicle_id);
                      toast.success('Marked as Completed — vehicle is now available');
                    } else {
                      await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', insp.vehicle_id);
                      toast.success('Status updated — vehicle remains unavailable');
                    }
                    await fetchData();
                    const { data: refreshed } = await supabase.from('vehicle_inspections').select('*, inspection_items(*)').eq('id', insp.id).single();
                    if (refreshed) setSelectedInspection(refreshed);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold outline-none cursor-pointer dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <p className="mt-1 text-sm font-semibold text-emerald-600">✓ No Issues</p>
              )}
            </div>
          </div>

          {damaged.length > 0 && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">⚠ {damaged.length} item(s) with damage/issues detected</p>
            </div>
          )}

          {damaged.length === 0 && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">✓ All parts in good condition — no damage found</p>
            </div>
          )}

          {insp.notes && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
              <p className="text-sm dark:text-slate-200">{insp.notes}</p>
            </div>
          )}

          <h3 className="text-sm font-extrabold mb-3 dark:text-white">Damaged Parts Only</h3>
          {damaged.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No damaged parts to display.</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Part</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Condition</th>
                  {beforeInsp && <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Before Trip</th>}
                  <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Notes</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {damaged.map((item: any) => {
                  const beforeItem = beforeInsp?.inspection_items?.find((bi: any) => bi.part_id === item.part_id || bi.part_name === item.part_name);
                  const worsened = beforeItem && item.condition !== 'good' && beforeItem.condition === 'good';
                  return (
                    <tr key={item.id} className={worsened ? 'bg-rose-50/50 dark:bg-rose-500/5' : ''}>
                      <td className="px-3 py-2 font-medium dark:text-slate-200">{item.part_name}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conditionColor(item.condition)}`}>
                          {conditionLabel(item.condition)}
                        </span>
                        {worsened && <span className="ml-1 text-[10px] text-rose-600 font-bold">NEW</span>}
                      </td>
                      {beforeInsp && (
                        <td className="px-3 py-2">
                          {beforeItem && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conditionColor(beforeItem.condition)}`}>
                              {conditionLabel(beforeItem.condition)}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{item.damage_description || '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold dark:text-slate-200">
                        NPR {Number(item.repair_cost || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 dark:border-white/20 font-bold">
                  <td colSpan={beforeInsp ? 4 : 3} className="px-3 py-3 text-right text-sm dark:text-white">Total Damage Cost:</td>
                  <td className="px-3 py-3 text-right text-sm text-rose-700 dark:text-rose-300">NPR {damaged.reduce((sum: number, it: any) => sum + Number(it.repair_cost || 0), 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          )}

          {/* Generate Damage Invoice Button */}
          {damaged.length > 0 && (
            <div className="mt-4">
              <button onClick={() => generateDamageInvoice(insp, damaged)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                Generate Damage Invoice PDF
              </button>
            </div>
          )}
        </div>

        {/* Editable Damage Invoice Modal - INSIDE detail view */}
        {showDamageInvoice && damageInvoiceData && (
          <div className="fixed inset-0 z-[9999] overflow-auto bg-black/50 backdrop-blur-sm p-4 flex items-start justify-center">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1a2228] rounded-2xl shadow-2xl overflow-hidden mt-8">
              <div className="bg-[#1f7668] px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Edit Damage Invoice</h3>
                <button onClick={() => setShowDamageInvoice(false)} className="text-white/80 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Invoice #</label><input className={inp} value={damageInvoiceData.invoiceNumber} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, invoiceNumber: e.target.value})} /></div>
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label><input className={inp} value={damageInvoiceData.date} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, date: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Name</label><input className={inp} value={damageInvoiceData.customerName} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerName: e.target.value})} /></div>
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Phone</label><input className={inp} value={damageInvoiceData.customerPhone} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerPhone: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Email</label><input className={inp} value={damageInvoiceData.customerEmail} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerEmail: e.target.value})} /></div>
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Booking Ref</label><input className={inp} value={damageInvoiceData.bookingCode} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, bookingCode: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle</label><input className={inp} value={damageInvoiceData.vehicleName} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, vehicleName: e.target.value})} /></div>
                  <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle No.</label><input className={inp} value={damageInvoiceData.vehicleNumber} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, vehicleNumber: e.target.value})} /></div>
                </div>
                <h4 className="text-sm font-bold mt-4 dark:text-white">Damaged Parts</h4>
                <div className="space-y-2">
                  {damageInvoiceData.items.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-[1fr_100px_1fr_80px_30px] gap-2 items-center">
                      <input className={inp} value={item.partName} onChange={(e) => { const items = [...damageInvoiceData.items]; items[idx] = {...items[idx], partName: e.target.value}; setDamageInvoiceData({...damageInvoiceData, items}); }} placeholder="Part" />
                      <select className={inp} value={item.condition} onChange={(e) => { const items = [...damageInvoiceData.items]; items[idx] = {...items[idx], condition: e.target.value}; setDamageInvoiceData({...damageInvoiceData, items}); }}>
                        <option value="">Select</option>
                        <option value="Minor Damage">Minor Damage</option>
                        <option value="Major Damage">Major Damage</option>
                        <option value="Missing">Missing</option>
                        <option value="Good">Good</option>
                      </select>
                      <input className={inp} value={item.description} onChange={(e) => { const items = [...damageInvoiceData.items]; items[idx] = {...items[idx], description: e.target.value}; setDamageInvoiceData({...damageInvoiceData, items}); }} placeholder="Description" />
                      <input type="number" className={inp} value={item.cost} onChange={(e) => { const items = [...damageInvoiceData.items]; items[idx] = {...items[idx], cost: Number(e.target.value)}; setDamageInvoiceData({...damageInvoiceData, items}); }} />
                      <button onClick={() => { const items = damageInvoiceData.items.filter((_: any, i: number) => i !== idx); setDamageInvoiceData({...damageInvoiceData, items}); }} className="text-rose-500"><span className="material-symbols-outlined text-[16px]">close</span></button>
                    </div>
                  ))}
                  <button onClick={() => setDamageInvoiceData({...damageInvoiceData, items: [...damageInvoiceData.items, {partName:'',condition:'',description:'',cost:0}]})} className="text-xs font-semibold text-[#1f7668]">+ Add Item</button>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
                  <p className="text-lg font-bold dark:text-white">Total: NPR {damageInvoiceData.items.reduce((s: number, it: any) => s + Number(it.cost || 0), 0).toLocaleString()}</p>
                </div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label><textarea className={inp} rows={2} value={damageInvoiceData.notes} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, notes: e.target.value})} /></div>
              </div>
              <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-t dark:border-white/10 flex justify-end gap-3">
                <button onClick={() => setShowDamageInvoice(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10 dark:text-slate-200">Cancel</button>
                <button onClick={saveInvoiceEditsOnly} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185f54] inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">save</span> Save Changes
                </button>
                <button onClick={downloadDamageInvoicePDF} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">download</span> Save & Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Inspection History</h2>
        </div>
      </header>

      <div className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            placeholder="Search by vehicle name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inp + ' w-56'}
          />
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className={inp + ' w-48'}>
            <option value="">All Vehicles</option>
            {vehicles.map((v: any) => (
              <option key={v.id} value={v.id}>{v.brand} {v.name} {v.vehicle_number ? `(${v.vehicle_number})` : ''}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center"><div className="h-8 w-8 border-[3px] border-[#1f7668] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {inspections.length === 0 ? 'No inspections recorded yet. Use the Inspection feature in Booking Details to create one.' : 'No inspections match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Issues</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((insp: any) => {
                  const items = insp.inspection_items || [];
                  const damaged = items.filter((it: any) => it.condition !== 'good');
                  const currentStatus = insp.overall_condition || 'good';
                  return (
                    <tr key={insp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => setSelectedInspection(insp)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold dark:text-white">{getVehicleName(insp.vehicle_id)}</p>
                        <p className="text-xs text-slate-500">{getVehicleNumber(insp.vehicle_id)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${insp.inspection_type === 'before_trip' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                          {insp.inspection_type === 'before_trip' ? 'Before Trip' : 'After Trip'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {new Date(insp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${conditionColor(currentStatus)}`}>
                          {conditionLabel(currentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {damaged.length > 0 && currentStatus !== 'resolved' ? (
                          <span className="text-xs font-semibold text-rose-600">{damaged.length} issue(s)</span>
                        ) : damaged.length > 0 && currentStatus === 'resolved' ? (
                          <span className="text-xs text-slate-500 font-semibold">{damaged.length} (fixed)</span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-semibold">All Clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {damaged.length > 0 ? (
                          <select
                            value={currentStatus === 'resolved' ? 'completed' : (currentStatus === 'good' ? 'pending' : currentStatus)}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              const dbCondition = newStatus === 'completed' ? 'resolved' : newStatus;
                              await supabase.from('vehicle_inspections').update({ overall_condition: dbCondition }).eq('id', insp.id);
                              if (newStatus === 'completed') {
                                await supabase.from('vehicles').update({ status: 'available' }).eq('id', insp.vehicle_id);
                                toast.success('Status updated to Completed — vehicle is now available');
                              } else {
                                await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', insp.vehicle_id);
                                toast.success('Status updated — vehicle remains unavailable');
                              }
                              fetchData();
                            }}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border-0 outline-none cursor-pointer ${
                              currentStatus === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                              currentStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        ) : (
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700">✓ No Issues</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-[#1f7668] hover:bg-[#1f7668]/10 dark:border-white/10">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editable Damage Invoice Modal */}
      {showDamageInvoice && damageInvoiceData && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-black/50 backdrop-blur-sm p-4 flex items-start justify-center">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1a2228] rounded-2xl shadow-2xl overflow-hidden mt-8">
            <div className="bg-[#1f7668] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Edit Damage Invoice</h3>
              <button onClick={() => setShowDamageInvoice(false)} className="text-white/80 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Invoice #</label><input className={inp} value={damageInvoiceData.invoiceNumber} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, invoiceNumber: e.target.value})} /></div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label><input className={inp} value={damageInvoiceData.date} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, date: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Name</label><input className={inp} value={damageInvoiceData.customerName} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerName: e.target.value})} /></div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Phone</label><input className={inp} value={damageInvoiceData.customerPhone} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerPhone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer Email</label><input className={inp} value={damageInvoiceData.customerEmail} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, customerEmail: e.target.value})} /></div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Booking Ref</label><input className={inp} value={damageInvoiceData.bookingCode} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, bookingCode: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle</label><input className={inp} value={damageInvoiceData.vehicleName} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, vehicleName: e.target.value})} /></div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle No.</label><input className={inp} value={damageInvoiceData.vehicleNumber} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, vehicleNumber: e.target.value})} /></div>
              </div>

              <h4 className="text-sm font-bold mt-4 dark:text-white">Damaged Parts</h4>
              <div className="space-y-2">
                {damageInvoiceData.items.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_1fr_90px_30px] gap-2 items-center">
                    <input className={inp} value={item.partName} onChange={(e) => {
                      const items = [...damageInvoiceData.items]; items[idx].partName = e.target.value;
                      setDamageInvoiceData({...damageInvoiceData, items});
                    }} placeholder="Part" />
                    <select className={inp} value={item.condition} onChange={(e) => {
                      const items = [...damageInvoiceData.items]; items[idx].condition = e.target.value;
                      setDamageInvoiceData({...damageInvoiceData, items});
                    }}>
                      <option value="">Select</option>
                      <option value="Minor Damage">Minor Damage</option>
                      <option value="Major Damage">Major Damage</option>
                      <option value="Missing">Missing</option>
                      <option value="Good">Good</option>
                    </select>
                    <input className={inp} value={item.description} onChange={(e) => {
                      const items = [...damageInvoiceData.items]; items[idx].description = e.target.value;
                      setDamageInvoiceData({...damageInvoiceData, items});
                    }} placeholder="Description" />
                    <input type="number" className={inp} value={item.cost} onChange={(e) => {
                      const items = [...damageInvoiceData.items]; items[idx].cost = Number(e.target.value);
                      setDamageInvoiceData({...damageInvoiceData, items});
                    }} placeholder="Cost" />
                    <button onClick={() => {
                      const items = damageInvoiceData.items.filter((_: any, i: number) => i !== idx);
                      setDamageInvoiceData({...damageInvoiceData, items});
                    }} className="text-rose-500 hover:text-rose-700"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                  </div>
                ))}
                <button onClick={() => {
                  const items = [...damageInvoiceData.items, { partName: '', condition: '', description: '', cost: 0 }];
                  setDamageInvoiceData({...damageInvoiceData, items});
                }} className="text-xs font-semibold text-[#1f7668] hover:underline">+ Add Item</button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
                <p className="text-lg font-bold dark:text-white">Total: NPR {damageInvoiceData.items.reduce((s: number, it: any) => s + Number(it.cost || 0), 0).toLocaleString()}</p>
              </div>

              <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label><textarea className={inp} rows={2} value={damageInvoiceData.notes} onChange={(e) => setDamageInvoiceData({...damageInvoiceData, notes: e.target.value})} /></div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-t dark:border-white/10 flex justify-end gap-3">
              <button onClick={() => setShowDamageInvoice(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10 dark:text-slate-200">Cancel</button>
              <button onClick={saveInvoiceEditsOnly} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185f54] inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">save</span> Save Changes
              </button>
              <button onClick={downloadDamageInvoicePDF} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">download</span> Save & Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
