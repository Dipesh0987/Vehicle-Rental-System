-- =========================================================
-- BILLING & FINANCIAL MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =========================================================

-- ===================== INVOICES =====================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text UNIQUE NOT NULL,
  booking_id        uuid REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  customer_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  customer_phone    text,
  customer_address  text,

  -- Vehicle info
  vehicle_id        uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_name      text,
  vehicle_reg_no    text,

  -- Dates
  invoice_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date,
  booking_date      date,
  pickup_date       date,
  return_date       date,
  rental_duration   integer DEFAULT 0,

  -- Financial
  daily_rate        numeric(12,2) DEFAULT 0,
  rental_charges    numeric(12,2) DEFAULT 0,
  additional_charges numeric(12,2) DEFAULT 0,
  discount_amount   numeric(12,2) DEFAULT 0,
  discount_percent  numeric(5,2) DEFAULT 0,
  subtotal          numeric(12,2) DEFAULT 0,
  tax_rate          numeric(5,2) DEFAULT 13.00,
  tax_amount        numeric(12,2) DEFAULT 0,
  grand_total       numeric(12,2) DEFAULT 0,
  amount_paid       numeric(12,2) DEFAULT 0,
  outstanding_balance numeric(12,2) DEFAULT 0,

  -- Status
  status            text DEFAULT 'draft' CHECK (status IN ('draft','pending','partially_paid','paid','cancelled','overdue')),

  -- Metadata
  notes             text,
  terms             text,
  created_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);

-- ===================== INVOICE ITEMS =====================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     text NOT NULL,
  quantity        numeric(10,2) DEFAULT 1,
  unit_price      numeric(12,2) DEFAULT 0,
  amount          numeric(12,2) DEFAULT 0,
  item_type       text DEFAULT 'rental' CHECK (item_type IN ('rental','additional','fuel','damage','late_fee','insurance','other')),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ===================== BILLING PAYMENTS =====================
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  booking_id          uuid REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  customer_id         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  amount              numeric(12,2) NOT NULL DEFAULT 0,
  payment_method      text NOT NULL CHECK (payment_method IN ('online_qr','cash','bank_transfer','other')),
  payment_date        timestamptz DEFAULT now(),

  -- Online payment specific
  transaction_ref     text,
  payment_screenshot  text,
  qr_code_used        text,

  -- Verification
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  verified_by         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  verified_at         timestamptz,
  rejection_reason    text,

  -- Status
  payment_type        text DEFAULT 'full' CHECK (payment_type IN ('advance','partial','full','refund')),
  notes               text,
  created_by          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON public.billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_customer ON public.billing_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON public.billing_payments(verification_status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_date ON public.billing_payments(payment_date);

-- ===================== EXPENSES =====================
CREATE TABLE IF NOT EXISTS public.expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id        text UNIQUE,
  vehicle_id        uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  category          text NOT NULL CHECK (category IN ('fuel','maintenance','repair','insurance','staff','tax','miscellaneous')),
  amount            numeric(12,2) NOT NULL DEFAULT 0,
  description       text,
  expense_date      date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url       text,
  vendor_name       text,
  reference_number  text,
  added_by          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON public.expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);

-- ===================== VEHICLE FINANCES (Aggregated) =====================
CREATE TABLE IF NOT EXISTS public.vehicle_finances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          uuid UNIQUE NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  total_income        numeric(14,2) DEFAULT 0,
  total_expenses      numeric(14,2) DEFAULT 0,
  net_profit          numeric(14,2) DEFAULT 0,
  total_trips         integer DEFAULT 0,
  total_booked_days   integer DEFAULT 0,
  total_available_days integer DEFAULT 365,
  utilization_pct     numeric(5,2) DEFAULT 0,
  last_calculated_at  timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_finances_vehicle ON public.vehicle_finances(vehicle_id);

-- ===================== AUDIT LOGS =====================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  user_email    text,
  action        text NOT NULL,
  module        text NOT NULL,
  entity_type   text,
  entity_id     text,
  previous_value jsonb,
  new_value     jsonb,
  description   text,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- ===================== BILLING SETTINGS =====================
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     text UNIQUE NOT NULL,
  setting_value   text,
  setting_type    text DEFAULT 'text',
  description     text,
  updated_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO public.billing_settings (setting_key, setting_value, setting_type, description) VALUES
  ('company_name', 'Self Drive Car Rental', 'text', 'Company name for invoices'),
  ('company_address', 'Kathmandu, Nepal', 'text', 'Company address'),
  ('company_phone', '+977-1-XXXXXXX', 'text', 'Company phone'),
  ('company_email', 'info@selfdrivecarrental.com', 'text', 'Company email'),
  ('tax_rate', '13', 'number', 'Default tax rate percentage'),
  ('invoice_prefix', 'INV', 'text', 'Invoice number prefix'),
  ('invoice_terms', 'Payment is due within 7 days of invoice date. Late payments may incur additional charges.', 'text', 'Default invoice terms'),
  ('qr_code_image', '', 'text', 'QR code image URL for online payments'),
  ('currency', 'NPR', 'text', 'Default currency'),
  ('currency_symbol', 'Rs.', 'text', 'Currency symbol')
ON CONFLICT (setting_key) DO NOTHING;

-- ===================== ROW LEVEL SECURITY =====================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Admin full access (drop first for idempotency)
DROP POLICY IF EXISTS "Admin full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin full access billing_payments" ON public.billing_payments;
DROP POLICY IF EXISTS "Admin full access expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admin full access vehicle_finances" ON public.vehicle_finances;
DROP POLICY IF EXISTS "Admin full access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admin full access billing_settings" ON public.billing_settings;
DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers view own payments" ON public.billing_payments;

CREATE POLICY "Admin full access invoices" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Admin full access invoice_items" ON public.invoice_items FOR ALL USING (true);
CREATE POLICY "Admin full access billing_payments" ON public.billing_payments FOR ALL USING (true);
CREATE POLICY "Admin full access expenses" ON public.expenses FOR ALL USING (true);
CREATE POLICY "Admin full access vehicle_finances" ON public.vehicle_finances FOR ALL USING (true);
CREATE POLICY "Admin full access audit_logs" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Admin full access billing_settings" ON public.billing_settings FOR ALL USING (true);

-- Customer can view their own invoices
CREATE POLICY "Customers view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = customer_id);

-- Customer can view their own payments
CREATE POLICY "Customers view own payments" ON public.billing_payments
  FOR SELECT USING (auth.uid() = customer_id);

-- ===================== STORAGE BUCKET FOR RECEIPTS =====================
-- Run this in Supabase dashboard if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('billing-receipts', 'billing-receipts', true) ON CONFLICT DO NOTHING;
