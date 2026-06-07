'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

const FUEL_LEVELS = ['full', '3/4', '1/2', '1/4', 'empty'];
const CONDITIONS = [
  { value: 'good', label: 'Good', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { value: 'minor_damage', label: 'Minor Damage', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { value: 'major_damage', label: 'Major Damage', color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
  { value: 'missing', label: 'Missing', color: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
];

const CATEGORIES = ['exterior', 'interior', 'documents'];

const DEFAULT_PARTS = [
  { id: '1', part_name: 'Front Bumper', part_category: 'exterior', default_cost: 15000 },
  { id: '2', part_name: 'Rear Bumper', part_category: 'exterior', default_cost: 15000 },
  { id: '3', part_name: 'Hood/Bonnet', part_category: 'exterior', default_cost: 20000 },
  { id: '4', part_name: 'Front Left Fender', part_category: 'exterior', default_cost: 12000 },
  { id: '5', part_name: 'Front Right Fender', part_category: 'exterior', default_cost: 12000 },
  { id: '6', part_name: 'Front Left Door', part_category: 'exterior', default_cost: 25000 },
  { id: '7', part_name: 'Front Right Door', part_category: 'exterior', default_cost: 25000 },
  { id: '8', part_name: 'Rear Left Door', part_category: 'exterior', default_cost: 25000 },
  { id: '9', part_name: 'Rear Right Door', part_category: 'exterior', default_cost: 25000 },
  { id: '10', part_name: 'Front Windshield', part_category: 'exterior', default_cost: 25000 },
  { id: '11', part_name: 'Rear Windshield', part_category: 'exterior', default_cost: 20000 },
  { id: '12', part_name: 'Left Side Mirror', part_category: 'exterior', default_cost: 8000 },
  { id: '13', part_name: 'Right Side Mirror', part_category: 'exterior', default_cost: 8000 },
  { id: '14', part_name: 'Front Left Headlight', part_category: 'exterior', default_cost: 15000 },
  { id: '15', part_name: 'Front Right Headlight', part_category: 'exterior', default_cost: 15000 },
  { id: '16', part_name: 'Rear Left Taillight', part_category: 'exterior', default_cost: 8000 },
  { id: '17', part_name: 'Rear Right Taillight', part_category: 'exterior', default_cost: 8000 },
  { id: '18', part_name: 'Front Left Wheel', part_category: 'exterior', default_cost: 12000 },
  { id: '19', part_name: 'Front Right Wheel', part_category: 'exterior', default_cost: 12000 },
  { id: '20', part_name: 'Rear Left Wheel', part_category: 'exterior', default_cost: 12000 },
  { id: '21', part_name: 'Rear Right Wheel', part_category: 'exterior', default_cost: 12000 },
  { id: '22', part_name: 'Dashboard', part_category: 'interior', default_cost: 20000 },
  { id: '23', part_name: 'Steering Wheel', part_category: 'interior', default_cost: 15000 },
  { id: '24', part_name: 'Driver Seat', part_category: 'interior', default_cost: 25000 },
  { id: '25', part_name: 'Passenger Seat', part_category: 'interior', default_cost: 25000 },
  { id: '26', part_name: 'Rear Seats', part_category: 'interior', default_cost: 30000 },
  { id: '27', part_name: 'Floor Mats', part_category: 'interior', default_cost: 3000 },
  { id: '28', part_name: 'Infotainment System', part_category: 'interior', default_cost: 35000 },
  { id: '29', part_name: 'AC Vents', part_category: 'interior', default_cost: 5000 },
  { id: '30', part_name: 'Rearview Mirror', part_category: 'interior', default_cost: 3000 },
  { id: '31', part_name: 'Registration Document', part_category: 'documents', default_cost: 5000 },
  { id: '32', part_name: 'Insurance Papers', part_category: 'documents', default_cost: 2000 },
  { id: '33', part_name: 'First Aid Kit', part_category: 'documents', default_cost: 1500 },
  { id: '34', part_name: 'Fire Extinguisher', part_category: 'documents', default_cost: 2000 },
  { id: '35', part_name: 'Jack & Tools', part_category: 'documents', default_cost: 5000 },
  { id: '36', part_name: 'Spare Tire', part_category: 'documents', default_cost: 8000 },
];

interface Part {
  id: string;
  part_name: string;
  part_category: string;
  default_cost: number;
}

interface PartCondition {
  condition: string;
  damage_description: string;
  repair_cost: number;
  before_condition?: string;
}

interface Booking {
  id: string;
  vehicle_id: string;
  booking_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  user_id?: string;
  vehicles?: {
    name: string;
    vehicle_number: string;
  };
  vehicle_name?: string;
  vehicle_number?: string;
  user_profiles?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

interface VehicleInspectionProps {
  booking: Booking;
  inspectionType: 'before_trip' | 'after_trip';
  onComplete?: () => void;
  onCancel?: () => void;
}

const getInitialConditions = (partsArray: Part[]) => {
  const initial: Record<string, PartCondition> = {};
  partsArray.forEach(p => {
    initial[p.id] = { condition: 'good', damage_description: '', repair_cost: p.default_cost || 0 };
  });
  return initial;
};

export default function VehicleInspection({ booking, inspectionType, onComplete, onCancel }: VehicleInspectionProps) {
  const [parts, setParts] = useState<Part[]>(DEFAULT_PARTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('exterior');
  const [inspectionData, setInspectionData] = useState({
    fuel_level: 'full',
    odometer_reading: '',
    overall_condition: 'good',
    notes: '',
  });
  const [partConditions, setPartConditions] = useState<Record<string, PartCondition>>(() => getInitialConditions(DEFAULT_PARTS));
  const [beforeInspection, setBeforeInspection] = useState<any>(null);

  useEffect(() => {
    fetchParts();
    if (inspectionType === 'after_trip') {
      fetchBeforeInspection();
    }
  }, [booking?.id, inspectionType]);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_parts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (!error && data && data.length > 0) {
        setParts(data);
        setPartConditions(getInitialConditions(data));
      }
    } catch (err) {
      console.error('Fetch parts error:', err);
    }
  };

  const fetchBeforeInspection = async () => {
    const { data } = await supabase
      .from('vehicle_inspections')
      .select('*, inspection_items(*)')
      .eq('booking_id', booking.id)
      .eq('inspection_type', 'before_trip')
      .single();
    
    if (data) {
      setBeforeInspection(data);
      const conditions: Record<string, PartCondition> = {};
      (data.inspection_items || []).forEach((item: any) => {
        conditions[item.part_id] = {
          condition: item.condition,
          damage_description: item.damage_description || '',
          repair_cost: item.repair_cost || 0,
          before_condition: item.condition
        };
      });
      setPartConditions(prev => ({ ...prev, ...conditions }));
      setInspectionData(prev => ({
        ...prev,
        fuel_level: data.fuel_level || 'full',
        odometer_reading: data.odometer_reading || ''
      }));
    }
  };

  const partsByCategory = useMemo(() => {
    const grouped: Record<string, Part[]> = {};
    CATEGORIES.forEach(cat => { grouped[cat] = []; });
    parts.forEach(p => {
      if (grouped[p.part_category]) {
        grouped[p.part_category].push(p);
      }
    });
    return grouped;
  }, [parts]);

  const updatePartCondition = (partId: string, field: string, value: any) => {
    setPartConditions(prev => ({
      ...prev,
      [partId]: { ...prev[partId], [field]: value }
    }));
  };

  const setAllPartsCondition = (condition: string) => {
    const updated: Record<string, PartCondition> = {};
    parts.forEach(p => {
      updated[p.id] = { ...partConditions[p.id], condition };
    });
    setPartConditions(updated);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: inspection, error: inspError } = await supabase
        .from('vehicle_inspections')
        .insert({
          booking_id: booking.id,
          vehicle_id: booking.vehicle_id,
          inspection_type: inspectionType,
          fuel_level: inspectionData.fuel_level,
          odometer_reading: inspectionData.odometer_reading || null,
          overall_condition: inspectionData.overall_condition,
          notes: inspectionData.notes,
        })
        .select()
        .single();

      if (inspError) throw inspError;

      const items = parts.map(p => ({
        inspection_id: inspection.id,
        part_id: p.id,
        part_name: p.part_name,
        condition: partConditions[p.id]?.condition || 'good',
        damage_description: partConditions[p.id]?.damage_description || null,
        repair_cost: partConditions[p.id]?.condition !== 'good' ? (partConditions[p.id]?.repair_cost || p.default_cost) : 0,
      }));

      const { error: itemsError } = await supabase
        .from('inspection_items')
        .insert(items);

      if (itemsError) throw itemsError;

      const newStatus = inspectionType === 'before_trip' ? 'before_done' : 'after_done';
      await supabase
        .from('bookings')
        .update({ inspection_status: newStatus })
        .eq('id', booking.id);

      if (inspectionType === 'after_trip' && beforeInspection) {
        await checkAndCreateDamageClaim(inspection.id);
      }

      alert(`${inspectionType === 'before_trip' ? 'Before Trip' : 'After Trip'} inspection saved successfully!`);
      onComplete?.();
    } catch (err: any) {
      console.error('Error saving inspection:', err);
      alert('Failed to save inspection: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const checkAndCreateDamageClaim = async (afterInspectionId: string) => {
    const damages: any[] = [];
    
    parts.forEach(p => {
      const beforeCond = beforeInspection?.inspection_items?.find((i: any) => i.part_id === p.id)?.condition || 'good';
      const afterCond = partConditions[p.id]?.condition || 'good';
      
      const conditionOrder = ['good', 'minor_damage', 'major_damage', 'missing'];
      if (conditionOrder.indexOf(afterCond) > conditionOrder.indexOf(beforeCond)) {
        damages.push({
          part_name: p.part_name,
          before_condition: beforeCond,
          after_condition: afterCond,
          damage_description: partConditions[p.id]?.damage_description || '',
          repair_cost: partConditions[p.id]?.repair_cost || p.default_cost || 0,
        });
      }
    });

    if (damages.length > 0) {
      const totalCost = damages.reduce((sum, d) => sum + Number(d.repair_cost || 0), 0);
      
      const { data: claim, error: claimError } = await supabase
        .from('damage_claims')
        .insert({
          booking_id: booking.id,
          vehicle_id: booking.vehicle_id,
          customer_id: booking.user_id,
          customer_name: booking.customer_name || booking.user_profiles?.full_name,
          customer_email: booking.customer_email || booking.user_profiles?.email,
          customer_phone: booking.customer_phone || booking.user_profiles?.phone,
          before_inspection_id: beforeInspection.id,
          after_inspection_id: afterInspectionId,
          total_damage_cost: totalCost,
          status: 'pending',
        })
        .select()
        .single();

      if (claimError) {
        console.error('Error creating damage claim:', claimError);
        return;
      }

      const claimItems = damages.map(d => ({
        claim_id: claim.id,
        ...d
      }));

      await supabase.from('damage_claim_items').insert(claimItems);
      
      alert(`⚠️ ${damages.length} damage(s) detected! Damage claim #${claim.claim_number} created with total cost NPR ${totalCost.toLocaleString()}`);
    }
  };

  const damagedPartsCount = useMemo(() => {
    return Object.values(partConditions).filter(p => p.condition !== 'good').length;
  }, [partConditions]);

  const totalDamageCost = useMemo(() => {
    return Object.entries(partConditions).reduce((sum, [_, data]) => {
      if (data.condition !== 'good') {
        return sum + Number(data.repair_cost || 0);
      }
      return sum;
    }, 0);
  }, [partConditions]);

  if (loading) {
    return (
      <div className={`${panel} p-8 text-center`}>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f7668] border-t-transparent"></div>
        <p className="mt-2 text-sm text-slate-500">Loading inspection checklist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${panel} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">
              {inspectionType === 'before_trip' ? '🚗 Before Trip Inspection' : '🔍 After Trip Inspection'}
            </h2>
            <p className="text-sm text-slate-500">
              {booking?.vehicles?.name || booking?.vehicle_name} • {booking?.vehicles?.vehicle_number || booking?.vehicle_number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Booking #{booking?.booking_id}</p>
            <p className="text-xs text-slate-500">{booking?.customer_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${panel} p-3 text-center`}>
          <p className="text-2xl font-bold text-emerald-600">{parts.length - damagedPartsCount}</p>
          <p className="text-xs text-slate-500">Good Condition</p>
        </div>
        <div className={`${panel} p-3 text-center`}>
          <p className="text-2xl font-bold text-amber-600">{damagedPartsCount}</p>
          <p className="text-xs text-slate-500">Issues Found</p>
        </div>
        <div className={`${panel} p-3 text-center`}>
          <p className="text-2xl font-bold text-rose-600">NPR {totalDamageCost.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Estimated Cost</p>
        </div>
        <div className={`${panel} p-3 text-center`}>
          <p className="text-2xl font-bold text-blue-600">{parts.length}</p>
          <p className="text-xs text-slate-500">Total Parts</p>
        </div>
      </div>

      <div className={`${panel} p-4`}>
        <h3 className="mb-3 font-semibold">General Information</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Fuel Level</label>
            <select
              className={inp}
              value={inspectionData.fuel_level}
              onChange={(e) => setInspectionData(prev => ({ ...prev, fuel_level: e.target.value }))}
            >
              {FUEL_LEVELS.map(f => (
                <option key={f} value={f}>{f.replace('/', ' / ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Odometer (km)</label>
            <input
              type="number"
              className={inp}
              value={inspectionData.odometer_reading}
              onChange={(e) => setInspectionData(prev => ({ ...prev, odometer_reading: e.target.value }))}
              placeholder="e.g., 45230"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Overall Condition</label>
            <select
              className={inp}
              value={inspectionData.overall_condition}
              onChange={(e) => setInspectionData(prev => ({ ...prev, overall_condition: e.target.value }))}
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Quick Set All</label>
            <select
              className={inp}
              onChange={(e) => e.target.value && setAllPartsCondition(e.target.value)}
              defaultValue=""
            >
              <option value="">-- Select --</option>
              {CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeCategory === cat
                ? 'bg-[#1f7668] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)} ({partsByCategory[cat]?.length || 0})
          </button>
        ))}
      </div>

      <div className={`${panel} overflow-hidden`}>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Part</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Condition</th>
                {inspectionType === 'after_trip' && (
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Before</th>
                )}
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Notes</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Cost (NPR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(partsByCategory[activeCategory] || []).map(part => {
                const cond = partConditions[part.id] || { condition: 'good', damage_description: '', repair_cost: part.default_cost };
                const conditionInfo = CONDITIONS.find(c => c.value === cond.condition) || CONDITIONS[0];
                const beforeCond = cond.before_condition;
                const hasChanged = inspectionType === 'after_trip' && beforeCond && beforeCond !== cond.condition;
                
                return (
                  <tr key={part.id} className={`${hasChanged ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{part.part_name}</span>
                      {hasChanged && <span className="ml-2 text-xs text-amber-600">⚠️ Changed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${conditionInfo.color}`}
                        value={cond.condition}
                        onChange={(e) => updatePartCondition(part.id, 'condition', e.target.value)}
                      >
                        {CONDITIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    {inspectionType === 'after_trip' && (
                      <td className="px-4 py-3">
                        {beforeCond && (
                          <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${CONDITIONS.find(c => c.value === beforeCond)?.color || ''}`}>
                            {CONDITIONS.find(c => c.value === beforeCond)?.label || beforeCond}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {cond.condition !== 'good' && (
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                          placeholder="Describe damage..."
                          value={cond.damage_description}
                          onChange={(e) => updatePartCondition(part.id, 'damage_description', e.target.value)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cond.condition !== 'good' ? (
                        <input
                          type="number"
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs dark:border-white/10 dark:bg-white/5"
                          value={cond.repair_cost}
                          onChange={(e) => updatePartCondition(part.id, 'repair_cost', e.target.value)}
                        />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${panel} p-4`}>
        <label className="mb-2 block text-sm font-semibold">Additional Notes</label>
        <textarea
          className={inp}
          rows={3}
          value={inspectionData.notes}
          onChange={(e) => setInspectionData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional observations..."
        />
      </div>

      <div className="flex justify-between gap-3">
        <button
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1f7668] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {saving ? 'Saving...' : 'Complete Inspection'}
        </button>
      </div>
    </div>
  );
}
