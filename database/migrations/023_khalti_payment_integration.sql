-- 023_khalti_payment_integration.sql
-- Purpose: End-to-end Khalti (and future) payment ledger with partial-payment
-- support, generated transaction codes (P-XXXX), receipt records, in-app
-- notifications, and RLS so customers see only their own data.
--
-- Tables introduced
--   public.payments                  one row per payment attempt (Khalti pidx)
--   public.payment_receipts          one row per generated invoice + email log
--   public.notifications             user-facing in-app notifications
--
-- Booking columns extended
--   payment_status enlarged from {paid,unpaid} to include {partial,failed,
--   expired,refunded}
--   paid_amount, remaining_amount, payment_deadline added
--
-- Triggers
--   tg_payments_after_complete       updates booking.paid_amount, remaining,
--                                    payment_status; emits notification
--   tg_payments_set_transaction_code generates 'P-XXXX' before insert
--   tg_receipts_set_receipt_code     generates 'INV-XXXXXXXX' before insert
--
-- All write paths are intended for the service role (Edge Functions). Public
-- and authenticated users can only SELECT their own rows. Admin users can
-- SELECT/UPDATE everything.

create extension if not exists pgcrypto;

------------------------------------------------------------------------------
-- 1. Booking ledger columns
------------------------------------------------------------------------------

alter table public.vehicle_bookings
  add column if not exists paid_amount numeric(10, 2) not null default 0
    check (paid_amount >= 0);

alter table public.vehicle_bookings
  add column if not exists remaining_amount numeric(10, 2) not null default 0
    check (remaining_amount >= 0);

alter table public.vehicle_bookings
  add column if not exists payment_deadline timestamptz;

-- Backfill remaining_amount = total_amount for legacy rows so the new field is
-- meaningful from day one.
update public.vehicle_bookings
   set remaining_amount = greatest(0, total_amount - coalesce(paid_amount, 0))
 where remaining_amount = 0
   and coalesce(total_amount, 0) > coalesce(paid_amount, 0);

-- Drop the narrow {paid,unpaid} constraint and replace with the broader
-- payment lifecycle states the new flow needs.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_bookings_payment_status_check'
      and conrelid = 'public.vehicle_bookings'::regclass
  ) then
    alter table public.vehicle_bookings
      drop constraint vehicle_bookings_payment_status_check;
  end if;
end;
$$;

alter table public.vehicle_bookings
  add constraint vehicle_bookings_payment_status_check
  check (payment_status in (
    'unpaid', 'pending', 'partial', 'paid', 'failed', 'expired', 'refunded'
  ));

create index if not exists idx_vehicle_bookings_payment_status_created
  on public.vehicle_bookings (payment_status, created_at desc);

create index if not exists idx_vehicle_bookings_payment_deadline
  on public.vehicle_bookings (payment_deadline)
  where payment_deadline is not null;

------------------------------------------------------------------------------
-- 2. Transaction-code sequence and helper
------------------------------------------------------------------------------

create sequence if not exists public.payments_transaction_code_seq
  start with 1001
  increment by 1
  no maxvalue
  cache 1;

create or replace function public.generate_payment_transaction_code()
returns text
language plpgsql
volatile
as $$
declare
  next_value bigint;
begin
  next_value := nextval('public.payments_transaction_code_seq');
  -- 'P-XXXX' for the first 9_000 records, then naturally widens to P-10000+.
  return 'P-' || lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.generate_payment_transaction_code() from public;
grant execute on function public.generate_payment_transaction_code()
  to authenticated, service_role;

------------------------------------------------------------------------------
-- 3. Receipt-code sequence and helper
------------------------------------------------------------------------------

create sequence if not exists public.payment_receipts_code_seq
  start with 10001
  increment by 1
  no maxvalue
  cache 1;

create or replace function public.generate_payment_receipt_code()
returns text
language plpgsql
volatile
as $$
declare
  next_value bigint;
begin
  next_value := nextval('public.payment_receipts_code_seq');
  return 'INV-' || lpad(next_value::text, 6, '0');
end;
$$;

revoke all on function public.generate_payment_receipt_code() from public;
grant execute on function public.generate_payment_receipt_code()
  to authenticated, service_role;

------------------------------------------------------------------------------
-- 4. payments table
------------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_code text not null unique,
  booking_id uuid not null
    references public.vehicle_bookings(id) on delete cascade,
  customer_user_id uuid
    references auth.users(id) on delete set null,
  customer_email text not null default '',
  customer_name text not null default '',
  payment_method text not null default 'khalti',
  payment_type text not null default 'full',
  amount numeric(10, 2) not null check (amount >= 0),
  total_booking_amount numeric(10, 2) not null check (total_booking_amount >= 0),
  currency text not null default 'NPR',
  status text not null default 'initiated',
  failure_reason text,
  khalti_pidx text,
  khalti_transaction_id text,
  khalti_payment_url text,
  khalti_response jsonb not null default '{}'::jsonb,
  initiated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_payment_type_check
    check (payment_type in ('full', 'partial')),
  constraint payments_status_check
    check (status in (
      'initiated', 'pending', 'completed', 'failed', 'expired',
      'refunded', 'cancelled'
    )),
  constraint payments_method_check
    check (payment_method in ('khalti', 'esewa', 'card', 'cash', 'bank_transfer'))
);

create index if not exists idx_payments_booking_id
  on public.payments (booking_id, created_at desc);

create index if not exists idx_payments_user_id
  on public.payments (customer_user_id, created_at desc);

create index if not exists idx_payments_status_created
  on public.payments (status, created_at desc);

create index if not exists idx_payments_pidx
  on public.payments (khalti_pidx)
  where khalti_pidx is not null;

------------------------------------------------------------------------------
-- 5. payment_receipts table
------------------------------------------------------------------------------

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_code text not null unique,
  payment_id uuid not null
    references public.payments(id) on delete cascade,
  booking_id uuid not null
    references public.vehicle_bookings(id) on delete cascade,
  customer_user_id uuid
    references auth.users(id) on delete set null,
  email_to text not null,
  email_status text not null default 'pending',
  email_sent_at timestamptz,
  email_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_receipts_email_status_check
    check (email_status in ('pending', 'sent', 'failed'))
);

create index if not exists idx_payment_receipts_payment_id
  on public.payment_receipts (payment_id);

create index if not exists idx_payment_receipts_booking_id
  on public.payment_receipts (booking_id, created_at desc);

create index if not exists idx_payment_receipts_user_id
  on public.payment_receipts (customer_user_id, created_at desc);

------------------------------------------------------------------------------
-- 6. notifications table
------------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid
    references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_admin boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in (
    'payment_initiated', 'payment_success', 'payment_failed',
    'payment_expired', 'receipt_sent', 'booking_confirmed',
    'booking_status_changed', 'payment_due', 'admin_payment_alert', 'general'
  ))
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_user_recent
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_admin_recent
  on public.notifications (created_at desc)
  where is_admin = true;

------------------------------------------------------------------------------
-- 7. Triggers: keep updated_at fresh and assign generated codes
------------------------------------------------------------------------------

create or replace function public.set_updated_at_payments()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at_payments();

drop trigger if exists trg_payment_receipts_set_updated_at
  on public.payment_receipts;
create trigger trg_payment_receipts_set_updated_at
before update on public.payment_receipts
for each row
execute function public.set_updated_at_payments();

create or replace function public.payments_assign_transaction_code()
returns trigger
language plpgsql
as $$
begin
  if coalesce(trim(new.transaction_code), '') = '' then
    new.transaction_code := public.generate_payment_transaction_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payments_assign_transaction_code on public.payments;
create trigger trg_payments_assign_transaction_code
before insert on public.payments
for each row
execute function public.payments_assign_transaction_code();

create or replace function public.payment_receipts_assign_code()
returns trigger
language plpgsql
as $$
begin
  if coalesce(trim(new.receipt_code), '') = '' then
    new.receipt_code := public.generate_payment_receipt_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_receipts_assign_code
  on public.payment_receipts;
create trigger trg_payment_receipts_assign_code
before insert on public.payment_receipts
for each row
execute function public.payment_receipts_assign_code();

------------------------------------------------------------------------------
-- 8. Trigger: when a payment becomes 'completed', roll the amount into the
--    booking ledger and emit a user notification. Idempotent on re-runs.
------------------------------------------------------------------------------

create or replace function public.payments_apply_to_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_paid numeric(10, 2);
  current_total numeric(10, 2);
  new_paid numeric(10, 2);
  new_remaining numeric(10, 2);
  next_status text;
  is_full boolean;
  notif_title text;
  notif_body text;
  amount_text text;
begin
  -- Only when transitioning into 'completed'.
  if new.status <> 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new; -- already applied
  end if;

  if new.paid_at is null then
    new.paid_at := now();
  end if;

  select coalesce(paid_amount, 0), coalesce(total_amount, 0)
    into current_paid, current_total
    from public.vehicle_bookings
   where id = new.booking_id
   for update;

  new_paid := current_paid + new.amount;
  if new_paid > current_total then
    new_paid := current_total;
  end if;
  new_remaining := greatest(0, current_total - new_paid);
  is_full := new_remaining <= 0.005;
  next_status := case when is_full then 'paid' else 'partial' end;

  update public.vehicle_bookings
     set paid_amount = new_paid,
         remaining_amount = new_remaining,
         payment_status = next_status,
         is_paid = is_full,
         updated_at = now()
   where id = new.booking_id;

  -- User notification (only when we have a user to notify).
  amount_text := 'NPR ' || trim(to_char(new.amount, 'FM999G999G990D00'));
  if is_full then
    notif_title := 'Payment received - booking fully paid';
    notif_body := 'We received ' || amount_text
      || ' for your booking. Transaction ' || new.transaction_code
      || '. Your reservation is fully paid.';
  else
    notif_title := 'Partial payment received';
    notif_body := 'We received ' || amount_text
      || ' for your booking. Transaction ' || new.transaction_code
      || '. Remaining balance: NPR '
      || trim(to_char(new_remaining, 'FM999G999G990D00')) || '.';
  end if;

  if new.customer_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, link_url, metadata
    ) values (
      new.customer_user_id,
      'payment_success',
      notif_title,
      notif_body,
      '/frontend/payment-receipt.html?payment=' || new.transaction_code,
      jsonb_build_object(
        'transactionCode', new.transaction_code,
        'bookingId', new.booking_id,
        'amount', new.amount,
        'paidTotal', new_paid,
        'remaining', new_remaining,
        'paymentMethod', new.payment_method
      )
    );
  end if;

  -- Admin notification (one per completion).
  insert into public.notifications (
    user_id, is_admin, type, title, body, metadata
  ) values (
    null, true,
    'admin_payment_alert',
    'Payment ' || new.transaction_code || ' received',
    'Customer paid ' || amount_text
      || ' for booking ' || new.booking_id::text || '.',
    jsonb_build_object(
      'transactionCode', new.transaction_code,
      'bookingId', new.booking_id,
      'amount', new.amount,
      'paidTotal', new_paid,
      'remaining', new_remaining,
      'paymentMethod', new.payment_method
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_payments_apply_to_booking on public.payments;
create trigger trg_payments_apply_to_booking
before insert or update of status on public.payments
for each row
execute function public.payments_apply_to_booking();

------------------------------------------------------------------------------
-- 9. Trigger: emit notification on failure / expiry so the user can retry.
------------------------------------------------------------------------------

create or replace function public.payments_emit_failure_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_type text;
  notif_title text;
  notif_body text;
begin
  if tg_op = 'UPDATE'
     and new.status = old.status then
    return new;
  end if;

  if new.status = 'failed' then
    notif_type := 'payment_failed';
    notif_title := 'Payment did not go through';
    notif_body := coalesce(nullif(trim(new.failure_reason), ''),
      'Your payment attempt failed. You can retry from your bookings.');
  elsif new.status = 'expired' then
    notif_type := 'payment_expired';
    notif_title := 'Payment window expired';
    notif_body := 'Your payment window expired. Please initiate a new payment from your bookings.';
  else
    return new;
  end if;

  if new.customer_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, link_url, metadata
    ) values (
      new.customer_user_id,
      notif_type,
      notif_title,
      notif_body,
      '/frontend/payment.html?booking=' || new.booking_id::text,
      jsonb_build_object(
        'transactionCode', new.transaction_code,
        'bookingId', new.booking_id,
        'amount', new.amount,
        'failureReason', new.failure_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_emit_failure on public.payments;
create trigger trg_payments_emit_failure
after update of status on public.payments
for each row
execute function public.payments_emit_failure_notification();

------------------------------------------------------------------------------
-- 10. RLS policies
------------------------------------------------------------------------------

alter table public.payments enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.notifications enable row level security;

-- payments: customer reads own, admin reads all, only service role writes
drop policy if exists "Customers read own payments" on public.payments;
create policy "Customers read own payments"
  on public.payments for select
  to authenticated
  using (
    customer_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

drop policy if exists "Admins update payments" on public.payments;
create policy "Admins update payments"
  on public.payments for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

-- (No public insert/delete policies; Edge Functions use service role.)

-- payment_receipts: same pattern
drop policy if exists "Customers read own receipts" on public.payment_receipts;
create policy "Customers read own receipts"
  on public.payment_receipts for select
  to authenticated
  using (
    customer_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

drop policy if exists "Admins update receipts" on public.payment_receipts;
create policy "Admins update receipts"
  on public.payment_receipts for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

-- notifications: user sees own, admins see admin-flagged + their own,
-- user can mark own read.
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select
  to authenticated
  using (
    user_id = auth.uid()
    or (is_admin = true and public.is_admin_user(auth.uid()))
  );

drop policy if exists "Users mark own notifications" on public.notifications;
create policy "Users mark own notifications"
  on public.notifications for update
  to authenticated
  using (
    user_id = auth.uid()
    or (is_admin = true and public.is_admin_user(auth.uid()))
  )
  with check (
    user_id = auth.uid()
    or (is_admin = true and public.is_admin_user(auth.uid()))
  );

------------------------------------------------------------------------------
-- 11. RPC: mark notification(s) read with ownership enforced. Easier than
-- writing the same predicate from the frontend.
------------------------------------------------------------------------------

create or replace function public.mark_notifications_read(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
     set read_at = now()
   where read_at is null
     and id = any(p_ids)
     and (
       user_id = uid
       or (is_admin = true and public.is_admin_user(uid))
     );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[])
  to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required.';
  end if;

  update public.notifications
     set read_at = now()
   where read_at is null
     and user_id = uid;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read()
  to authenticated;

------------------------------------------------------------------------------
-- 12. RPC: expire stale unpaid bookings/payments. Intended for a scheduled
--     job (pg_cron / external cron) but also safe to call from the Edge
--     Function on read.
------------------------------------------------------------------------------

create or replace function public.expire_stale_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.payments
     set status = 'expired',
         updated_at = now()
   where status in ('initiated', 'pending')
     and expires_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_stale_payments() from public;
grant execute on function public.expire_stale_payments()
  to authenticated, service_role;

------------------------------------------------------------------------------
-- 13. Reload PostgREST schema cache
------------------------------------------------------------------------------

notify pgrst, 'reload schema';
