import { supabase } from '@/lib/supabase';

// Safe query wrapper for tables that may not exist
const safeQuery = async (queryFn: () => Promise<any>, fallback: any = null) => {
  try {
    return await queryFn();
  } catch (err: any) {
    console.warn('Table query failed (may not exist):', err.message);
    return { data: fallback, error: null };
  }
};

// =========================================================
// INVOICE NUMBER GENERATOR
// =========================================================
export function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(10000 + Math.random() * 90000));
  return `INV-${y}${m}-${seq}`;
}

// =========================================================
// INVOICE CRUD
// =========================================================
export async function getInvoices({ status, search, from, to, limit = 50, offset = 0 }: any = {}) {
  const result = await safeQuery(async () => {
    let q = supabase.from('invoices').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    if (search) q = q.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
    if (from) q = q.gte('invoice_date', from);
    if (to) q = q.lte('invoice_date', to);
    q = q.range(offset, offset + limit - 1);
    return await q;
  }, []);
  return { data: result.data || [], count: result.count || 0 };
}

export async function getInvoiceById(id: string) {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getInvoiceItems(invoiceId: string) {
  const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createInvoice(payload: any, items: any[] = []) {
  const invoiceNumber = payload.invoice_number || generateInvoiceNumber();
  const subtotal = Number(payload.rental_charges || 0) + Number(payload.additional_charges || 0) - Number(payload.discount_amount || 0);
  const taxAmount = subtotal * (Number(payload.tax_rate || 13) / 100);
  const grandTotal = subtotal + taxAmount;
  const outstanding = grandTotal - Number(payload.amount_paid || 0);

  const inv = {
    ...payload,
    invoice_number: invoiceNumber,
    subtotal: subtotal.toFixed(2),
    tax_amount: taxAmount.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    outstanding_balance: outstanding.toFixed(2),
    status: payload.status || 'pending',
  };

  const { data, error } = await supabase.from('invoices').insert(inv).select().single();
  if (error) throw error;

  if (items.length > 0) {
    const itemRows = items.map((it: any, i: number) => ({
      invoice_id: data.id,
      description: it.description,
      quantity: it.quantity || 1,
      unit_price: it.unit_price || 0,
      amount: (it.quantity || 1) * (it.unit_price || 0),
      item_type: it.item_type || 'rental',
      sort_order: i,
    }));
    await supabase.from('invoice_items').insert(itemRows);
  }

  await logAudit('create', 'invoices', 'invoice', data.id, null, data, `Invoice ${invoiceNumber} created`);
  return data;
}

export async function updateInvoice(id: string, updates: any) {
  const prev = await getInvoiceById(id);
  const subtotal = Number(updates.rental_charges ?? prev.rental_charges ?? 0) + Number(updates.additional_charges ?? prev.additional_charges ?? 0) - Number(updates.discount_amount ?? prev.discount_amount ?? 0);
  const taxRate = Number(updates.tax_rate ?? prev.tax_rate ?? 13);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;
  const amountPaid = Number(updates.amount_paid ?? prev.amount_paid ?? 0);
  const outstanding = grandTotal - amountPaid;

  const payload = {
    ...updates,
    subtotal: subtotal.toFixed(2),
    tax_amount: taxAmount.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    outstanding_balance: outstanding.toFixed(2),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('invoices').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await logAudit('update', 'invoices', 'invoice', id, prev, data, `Invoice ${data.invoice_number} updated`);
  return data;
}

export async function deleteInvoice(id: string) {
  const prev = await getInvoiceById(id);
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
  await logAudit('delete', 'invoices', 'invoice', id, prev, null, `Invoice ${prev.invoice_number} deleted`);
}

export async function updateInvoiceStatus(id: string, status: string) {
  return updateInvoice(id, { status });
}

// Auto-create invoice from booking
export async function createInvoiceFromBooking(booking: any) {
  const rentalDays = booking.rental_duration || Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000) || 1;
  const dailyRate = Number(booking.daily_rate || booking.total_amount / rentalDays || 0);
  const rentalCharges = dailyRate * rentalDays;

  const payload = {
    booking_id: booking.id,
    customer_id: booking.customer_id || booking.user_id,
    customer_name: booking.customer_name || 'Customer',
    customer_email: booking.customer_email || '',
    customer_phone: booking.customer_phone || '',
    vehicle_id: booking.vehicle_id,
    vehicle_name: booking.vehicle_name || booking.vehicles?.name || '',
    vehicle_reg_no: booking.vehicle_number || booking.vehicles?.vehicle_number || '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    booking_date: booking.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    pickup_date: booking.start_date,
    return_date: booking.end_date,
    rental_duration: rentalDays,
    daily_rate: dailyRate,
    rental_charges: rentalCharges,
    additional_charges: Number(booking.additional_charges || 0),
    discount_amount: Number(booking.discount_amount || 0),
    tax_rate: 13,
    status: 'pending',
  };

  const items = [
    { description: `Vehicle Rental - ${payload.vehicle_name} (${rentalDays} days)`, quantity: rentalDays, unit_price: dailyRate, item_type: 'rental' },
  ];
  if (payload.additional_charges > 0) {
    items.push({ description: 'Additional Charges', quantity: 1, unit_price: payload.additional_charges, item_type: 'additional' });
  }

  return createInvoice(payload, items);
}

// =========================================================
// BILLING PAYMENTS
// =========================================================
export async function getBillingPayments({ invoiceId, status, method, from, to, limit = 50, offset = 0 }: any = {}) {
  const result = await safeQuery(async () => {
    let q = supabase.from('billing_payments').select('*, invoices(invoice_number, customer_name, grand_total)', { count: 'exact' }).order('created_at', { ascending: false });
    if (invoiceId) q = q.eq('invoice_id', invoiceId);
    if (status && status !== 'all') q = q.eq('verification_status', status);
    if (method && method !== 'all') q = q.eq('payment_method', method);
    if (from) q = q.gte('payment_date', from);
    if (to) q = q.lte('payment_date', to);
    q = q.range(offset, offset + limit - 1);
    return await q;
  }, []);
  return { data: result.data || [], count: result.count || 0 };
}

export async function createBillingPayment(payload: any) {
  const { data, error } = await supabase.from('billing_payments').insert(payload).select().single();
  if (error) throw error;

  if (payload.invoice_id && payload.verification_status !== 'rejected') {
    await recalcInvoicePayments(payload.invoice_id);
  }
  await logAudit('create', 'payments', 'billing_payment', data.id, null, data, `Payment of ${payload.amount} recorded`);
  return data;
}

export async function verifyPayment(paymentId: string, verified: boolean, rejectionReason?: string) {
  const status = verified ? 'verified' : 'rejected';
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  const { data, error } = await supabase.from('billing_payments').update({
    verification_status: status,
    verified_by: userId,
    verified_at: new Date().toISOString(),
    rejection_reason: verified ? null : rejectionReason,
    updated_at: new Date().toISOString(),
  }).eq('id', paymentId).select().single();
  if (error) throw error;

  if (data.invoice_id) await recalcInvoicePayments(data.invoice_id);
  await logAudit(verified ? 'verify' : 'reject', 'payments', 'billing_payment', paymentId, null, data, `Payment ${verified ? 'verified' : 'rejected'}`);
  return data;
}

async function recalcInvoicePayments(invoiceId: string) {
  const { data: payments } = await supabase.from('billing_payments').select('amount, verification_status').eq('invoice_id', invoiceId).eq('verification_status', 'verified');
  const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const invoice = await getInvoiceById(invoiceId);
  const grandTotal = Number(invoice.grand_total || 0);
  const outstanding = grandTotal - totalPaid;
  let status = invoice.status;
  if (totalPaid >= grandTotal) status = 'paid';
  else if (totalPaid > 0) status = 'partially_paid';
  else status = 'pending';

  await supabase.from('invoices').update({ amount_paid: totalPaid.toFixed(2), outstanding_balance: outstanding.toFixed(2), status, updated_at: new Date().toISOString() }).eq('id', invoiceId);
}

// =========================================================
// EXPENSES
// =========================================================
export async function getExpenses({ category, vehicleId, search, from, to, limit = 50, offset = 0 }: any = {}) {
  const result = await safeQuery(async () => {
    let q = supabase.from('expenses').select('*, vehicles(name, vehicle_number)', { count: 'exact' }).order('expense_date', { ascending: false });
    if (category && category !== 'all') q = q.eq('category', category);
    if (vehicleId) q = q.eq('vehicle_id', vehicleId);
    if (search) q = q.or(`description.ilike.%${search}%,vendor_name.ilike.%${search}%,expense_id.ilike.%${search}%`);
    if (from) q = q.gte('expense_date', from);
    if (to) q = q.lte('expense_date', to);
    q = q.range(offset, offset + limit - 1);
    return await q;
  }, []);
  return { data: result.data || [], count: result.count || 0 };
}

export async function createExpense(payload: any) {
  const expenseId = `EXP-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase.from('expenses').insert({ ...payload, expense_id: expenseId }).select().single();
  if (error) throw error;
  await logAudit('create', 'expenses', 'expense', data.id, null, data, `Expense ${expenseId} created - ${payload.category} Rs.${payload.amount}`);
  return data;
}

export async function updateExpense(id: string, updates: any) {
  const { data, error } = await supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  await logAudit('update', 'expenses', 'expense', id, null, data, `Expense updated`);
  return data;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  await logAudit('delete', 'expenses', 'expense', id, null, null, `Expense deleted`);
}

export async function uploadExpenseReceipt(file: File) {
  const ext = file.name.split('.').pop();
  const path = `expenses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('billing-receipts').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('billing-receipts').getPublicUrl(path);
  return data.publicUrl;
}

// =========================================================
// VEHICLE PROFITABILITY (Disabled - vehicle_finances table not available)
// =========================================================
export async function getVehicleFinances() {
  return [];
}

export async function recalcVehicleFinance(vehicleId: string) {
  return null;
}

export async function recalcAllVehicleFinances() {
  return null;
}

// =========================================================
// FINANCIAL DASHBOARD STATS
// =========================================================
export async function getFinancialDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const safe = async (query: any) => { try { return await query; } catch (_) { return { data: null, count: 0 }; } };

  const [
    { data: todayInvoices },
    { data: monthInvoices },
    { data: yearInvoices },
    { data: allExpenses },
    { count: totalInvoices },
    { count: paidInvoices },
    { count: unpaidInvoices },
    { count: pendingVerifications },
    { data: qrPayments },
    { data: cashPayments },
    { data: outstandingInvs },
  ] = await Promise.all([
    safe(supabase.from('invoices').select('amount_paid').gte('invoice_date', today)),
    safe(supabase.from('invoices').select('amount_paid').gte('invoice_date', monthStart)),
    safe(supabase.from('invoices').select('amount_paid').gte('invoice_date', yearStart)),
    safe(supabase.from('expenses').select('amount').gte('expense_date', yearStart)),
    safe(supabase.from('invoices').select('id', { count: 'exact', head: true })),
    safe(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid')),
    safe(supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partially_paid', 'overdue'])),
    safe(supabase.from('billing_payments').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending')),
    safe(supabase.from('billing_payments').select('amount').eq('payment_method', 'online_qr').eq('verification_status', 'verified')),
    safe(supabase.from('billing_payments').select('amount').eq('payment_method', 'cash').eq('verification_status', 'verified')),
    safe(supabase.from('invoices').select('outstanding_balance').gt('outstanding_balance', 0)),
  ]);

  const todayRevenue = (todayInvoices || []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
  const monthlyRevenue = (monthInvoices || []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
  const yearlyRevenue = (yearInvoices || []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
  const totalExpenseAmt = (allExpenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const netProfit = yearlyRevenue - totalExpenseAmt;
  const totalOutstanding = (outstandingInvs || []).reduce((s: number, i: any) => s + Number(i.outstanding_balance || 0), 0);
  const totalQR = (qrPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const totalCash = (cashPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return {
    todayRevenue, monthlyRevenue, yearlyRevenue,
    totalExpenses: totalExpenseAmt, netProfit, totalOutstanding,
    totalInvoices: totalInvoices || 0,
    paidInvoices: paidInvoices || 0,
    unpaidInvoices: unpaidInvoices || 0,
    pendingVerifications: pendingVerifications || 0,
    totalQR, totalCash,
  };
}

export async function getRevenueChartData(months = 12) {
  const data: any[] = [];
  const now = new Date();
  const safe = async (query: any) => { try { return await query; } catch (_) { return { data: null }; } };
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().split('T')[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    
    const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
      safe(supabase.from('invoices').select('amount_paid').gte('invoice_date', start).lte('invoice_date', end)),
      safe(supabase.from('expenses').select('amount').gte('expense_date', start).lte('expense_date', end)),
    ]);

    const income = (incomeData || []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
    const expense = (expenseData || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    data.push({ label, income, expense, profit: income - expense });
  }
  return data;
}

// =========================================================
// REPORTS
// =========================================================
export async function getRevenueReport({ from, to }: any) {
  const { data, error } = await supabase.from('invoices').select('*').gte('invoice_date', from).lte('invoice_date', to).order('invoice_date', { ascending: false });
  if (error) { console.warn('Revenue report error:', error.message); return []; }
  return data || [];
}

export async function getExpenseReport({ from, to, category }: any) {
  let q = supabase.from('expenses').select('*, vehicles(name)').gte('expense_date', from).lte('expense_date', to);
  if (category && category !== 'all') q = q.eq('category', category);
  const { data } = await q.order('expense_date', { ascending: false });
  return data || [];
}

export async function getCustomerBillingHistory(customerId: string) {
  let invoices: any[] = [], payments: any[] = [], bookings: any[] = [];
  try {
    const { data } = await supabase.from('invoices').select('*').eq('customer_id', customerId).order('invoice_date', { ascending: false });
    invoices = data || [];
  } catch (_) {}
  try {
    const { data } = await supabase.from('billing_payments').select('*').eq('customer_id', customerId).order('payment_date', { ascending: false });
    payments = data || [];
  } catch (_) {}
  if (payments.length === 0) {
    try {
      const { data } = await supabase.from('payments').select('*').eq('user_id', customerId).order('created_at', { ascending: false });
      if (data && data.length > 0) {
        payments = data.map((p: any) => ({ id: p.id, payment_date: p.created_at, amount: p.amount, payment_method: p.method || 'online_qr', payment_type: 'booking', verification_status: p.status === 'completed' ? 'verified' : p.status, reference_number: p.transaction_id }));
      }
    } catch (_) {}
  }
  const { data: bkData } = await supabase.from('bookings').select('id, booking_code, vehicle_id, start_date, end_date, pickup_time, driver_option, base_amount, service_fee, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount, status, payment_status, is_paid, coupon_code, customer_name, customer_email, customer_phone, notes, created_at, vehicles:vehicle_id(name, brand, category, vehicle_number)').eq('user_id', customerId).order('created_at', { ascending: false });
  bookings = bkData || [];
  if (payments.length === 0) {
    payments = bookings.filter((b: any) => b.is_paid || b.payment_status === 'completed').map((b: any) => ({ id: b.id, payment_date: b.created_at, amount: b.paid_amount || b.total_amount, payment_method: 'cash', payment_type: 'booking', verification_status: 'verified' }));
  }
  const totalSpent = payments.filter((p: any) => p.verification_status === 'verified').reduce((s: number, p: any) => s + Number(p.amount || 0), 0) || bookings.filter((b: any) => b.is_paid || b.status === 'confirmed' || b.status === 'completed').reduce((s: number, b: any) => s + Number(b.paid_amount || b.total_amount || 0), 0);
  const totalOutstanding = invoices.reduce((s: number, i: any) => s + Number(i.outstanding_balance || 0), 0);
  return { invoices, payments, bookings, totalSpent, totalOutstanding };
}

// =========================================================
// BILLING SETTINGS
// =========================================================
export async function getBillingSettings() {
  const { data, error } = await supabase.from('billing_settings').select('*');
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
  return map;
}

export async function updateBillingSetting(key: string, value: string) {
  const { error } = await supabase.from('billing_settings').update({ setting_value: value, updated_at: new Date().toISOString() }).eq('setting_key', key);
  if (error) throw error;
}

// =========================================================
// AUDIT LOG
// =========================================================
export async function logAudit(action: string, module: string, entityType: string, entityId: string, previousValue: any, newValue: any, description: string) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    const userEmail = session?.session?.user?.email;
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      user_email: userEmail || null,
      action,
      module,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      previous_value: previousValue ? JSON.parse(JSON.stringify(previousValue)) : null,
      new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      description,
    });
  } catch (_) { }
}

export async function getAuditLogs({ module, action, from, to, limit = 100, offset = 0 }: any = {}) {
  const result = await safeQuery(async () => {
    let q = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (module && module !== 'all') q = q.eq('module', module);
    if (action && action !== 'all') q = q.eq('action', action);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    q = q.range(offset, offset + limit - 1);
    return await q;
  }, []);
  return { data: result.data || [], count: result.count || 0 };
}
