'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'company' | 'terms'>('company');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_settings').select('*');
    if (error) {
      console.error('Failed to fetch settings:', error);
    } else {
      const settingsObj: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        settingsObj[s.key] = s.value || '';
      });
      setSettings(settingsObj);
    }
    setLoading(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const saveSetting = async (key: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value: settings[key], updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      alert(`Setting "${key}" saved successfully!`);
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));
      
      for (const update of updates) {
        await supabase.from('app_settings').upsert(update, { onConflict: 'key' });
      }
      alert('All settings saved successfully!');
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Administration</p>
          <h2 className={heading}>Website Settings</h2>
        </div>
        <button
          onClick={saveAllSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1f7668] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('company')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'company' ? 'bg-[#1f7668] text-white' : 'border border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200'}`}
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">business</span>
          Company Info
        </button>
        <button
          onClick={() => setActiveTab('terms')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'terms' ? 'bg-[#1f7668] text-white' : 'border border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200'}`}
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">gavel</span>
          Terms & Conditions
        </button>
      </div>

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className={`${panel} p-6`}>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1f7668]">business</span>
            Company Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={(e) => updateSetting('company_name', e.target.value)}
                className={inp}
                placeholder="ASSelf"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={settings.company_phone || ''}
                onChange={(e) => updateSetting('company_phone', e.target.value)}
                className={inp}
                placeholder="+977 970-452-0781"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={settings.company_email || ''}
                onChange={(e) => updateSetting('company_email', e.target.value)}
                className={inp}
                placeholder="info@asselfdrive.com"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                WhatsApp Number (without +)
              </label>
              <input
                type="text"
                value={settings.whatsapp_number || ''}
                onChange={(e) => updateSetting('whatsapp_number', e.target.value)}
                className={inp}
                placeholder="9779704520781"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Company Address
              </label>
              <input
                type="text"
                value={settings.company_address || ''}
                onChange={(e) => updateSetting('company_address', e.target.value)}
                className={inp}
                placeholder="Banasthali, Kathmandu, Nepal"
              />
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Tab */}
      {activeTab === 'terms' && (
        <div className={`${panel} p-6`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1f7668]">gavel</span>
            Terms & Conditions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Edit the terms and conditions displayed on the website. Each line starting with a number will be formatted as a numbered item.
          </p>
          
          <textarea
            value={settings.terms_and_conditions || ''}
            onChange={(e) => updateSetting('terms_and_conditions', e.target.value)}
            rows={20}
            className={`${inp} resize-none font-mono text-sm`}
            placeholder="1. First term...
2. Second term...
3. Third term..."
          />
          
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">lightbulb</span>
              Preview
            </h4>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 max-h-[300px] overflow-y-auto">
              {(settings.terms_and_conditions || '').split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
