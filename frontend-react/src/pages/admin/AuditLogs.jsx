import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/billing.service';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const fmtDt = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const actionColors = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  verify: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  reject: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  export: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  login: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

const moduleIcons = {
  invoices: 'description',
  payments: 'credit_card',
  expenses: 'receipt_long',
  vehicles: 'directions_car',
  bookings: 'event_note',
  users: 'person',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const pageSize = 50;

  const fetch_ = async () => {
    setLoading(true);
    try {
      const { data, count } = await getAuditLogs({ module: moduleFilter, action: actionFilter, limit: pageSize, offset: page * pageSize });
      setLogs(data); setTotal(count);
    } catch (err) { console.error('Audit logs fetch error:', err); setLogs([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [moduleFilter, actionFilter, page]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">System</p>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Audit Logs</h2>
      </header>

      <section className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(0); }} className={`${inputCls} max-w-[160px]`}>
            <option value="all">All Modules</option>
            <option value="invoices">Invoices</option>
            <option value="payments">Payments</option>
            <option value="expenses">Expenses</option>
            <option value="vehicles">Vehicles</option>
            <option value="bookings">Bookings</option>
          </select>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }} className={`${inputCls} max-w-[140px]`}>
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="verify">Verify</option>
            <option value="reject">Reject</option>
          </select>
          <span className="ml-auto text-xs font-semibold text-slate-500">{total} entries</span>
        </div>

        {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : logs.length === 0 ? (
          <div className="py-8 text-center"><span className="material-symbols-outlined text-[48px] text-slate-300">history</span><p className="mt-2 text-sm text-slate-500">No audit logs found</p></div>
        ) : (
          <div className="mt-3 space-y-2">
            {logs.map((log) => {
              const ac = actionColors[log.action] || actionColors.update;
              const icon = moduleIcons[log.module] || 'article';
              const isExpanded = expanded === log.id;
              return (
                <div key={log.id} className="rounded-xl border border-slate-200 transition hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20">
                  <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="flex w-full items-start gap-3 p-3 text-left">
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-slate-500">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ac}`}>{log.action}</span>
                        <span className="text-xs font-semibold text-slate-500">{log.module}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{fmtDt(log.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{log.description || `${log.action} on ${log.entity_type}`}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{log.user_email || 'System'}</p>
                    </div>
                    <span className={`material-symbols-outlined text-[16px] text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-3 dark:border-white/5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {log.previous_value && (
                          <div><p className="text-[10px] font-bold uppercase text-slate-500">Previous Value</p><pre className="mt-1 max-h-[200px] overflow-auto rounded-lg bg-slate-50 p-2 text-xs dark:bg-white/5">{JSON.stringify(log.previous_value, null, 2)}</pre></div>
                        )}
                        {log.new_value && (
                          <div><p className="text-[10px] font-bold uppercase text-slate-500">New Value</p><pre className="mt-1 max-h-[200px] overflow-auto rounded-lg bg-slate-50 p-2 text-xs dark:bg-white/5">{JSON.stringify(log.new_value, null, 2)}</pre></div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Entity: <span className="font-semibold">{log.entity_type} / {log.entity_id}</span></span>
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {total > pageSize && (
          <div className="mt-3 flex items-center justify-between">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/10">Previous</button>
            <span className="text-xs text-slate-500">Page {page + 1} of {Math.ceil(total / pageSize)}</span>
            <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
