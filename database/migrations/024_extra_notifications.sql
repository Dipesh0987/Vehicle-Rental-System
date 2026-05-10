-- 024_extra_notifications.sql
-- Purpose: emit notifications for the user-visible lifecycle events that
-- migration 023 did not yet cover: a new booking has been received, and
-- the customer's KYC verification has been approved or rejected.
--
-- This migration is idempotent (safe to re-run) and only adds new triggers
-- + widens the notifications.type check constraint. No data is rewritten.

------------------------------------------------------------------------------
-- 1. Widen notifications.type to allow the three new lifecycle events.
------------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'notifications_type_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      drop constraint notifications_type_check;
  end if;
end;
$$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'payment_initiated', 'payment_success', 'payment_failed',
    'payment_expired', 'receipt_sent', 'booking_confirmed',
    'booking_status_changed', 'payment_due', 'admin_payment_alert',
    'booking_created', 'verification_approved', 'verification_rejected',
    'general'
  ));

------------------------------------------------------------------------------
-- 2. Trigger: emit a 'booking_created' notification when a customer files
--    a new booking. We attach the bookingId + total amount + booking_code
--    in metadata so the bell can deep-link straight into the bookings panel.
------------------------------------------------------------------------------

create or replace function public.notify_booking_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_label text := '';
begin
  if new.customer_user_id is null then
    return new;
  end if;

  begin
    select coalesce(nullif(trim(name), ''), '')
      into vehicle_label
      from public.vehicles
     where id = new.vehicle_id;
  exception when others then
    vehicle_label := '';
  end;

  insert into public.notifications (
    user_id, type, title, body, link_url, metadata
  ) values (
    new.customer_user_id,
    'booking_created',
    'Booking received',
    'Your booking ' || coalesce(new.booking_code, '')
      || case when vehicle_label <> '' then ' for ' || vehicle_label else '' end
      || ' has been received. Complete the payment to confirm your reservation.',
    '/frontend/payment.html?booking=' || new.id::text,
    jsonb_build_object(
      'bookingId', new.id::text,
      'bookingCode', coalesce(new.booking_code, ''),
      'totalAmount', coalesce(new.total_amount, 0),
      'currency', coalesce(new.currency, 'NPR')
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_created on public.vehicle_bookings;
create trigger trg_notify_booking_created
after insert on public.vehicle_bookings
for each row
execute function public.notify_booking_created();

------------------------------------------------------------------------------
-- 3. Trigger: emit 'verification_approved' / 'verification_rejected' when
--    the admin moves the user's KYC out of 'pending'. We do not notify on
--    'not_submitted' or on transitions FROM approved (resets), only on the
--    actual approve/reject decision.
------------------------------------------------------------------------------

create or replace function public.notify_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text := lower(coalesce(trim(old.verification_status), 'not_submitted'));
  new_status text := lower(coalesce(trim(new.verification_status), 'not_submitted'));
  note_text text := coalesce(nullif(trim(new.verification_note), ''), '');
begin
  if old_status = new_status then
    return new;
  end if;

  if new_status = 'approved' then
    insert into public.notifications (
      user_id, type, title, body, link_url, metadata
    ) values (
      new.id,
      'verification_approved',
      'Verification approved',
      'Your account has been verified. You can now book any vehicle on the platform.',
      '/frontend/index.html',
      jsonb_build_object(
        'verificationStatus', 'approved',
        'reviewedAt', coalesce(new.verification_reviewed_at, now())
      )
    );
  elsif new_status = 'rejected' then
    insert into public.notifications (
      user_id, type, title, body, link_url, metadata
    ) values (
      new.id,
      'verification_rejected',
      'Verification could not be approved',
      case
        when note_text <> ''
        then 'Reviewer note: ' || note_text || ' Please update your details and resubmit.'
        else 'Please update your verification details and resubmit.'
      end,
      '/frontend/profile-verification.html',
      jsonb_build_object(
        'verificationStatus', 'rejected',
        'reviewedAt', coalesce(new.verification_reviewed_at, now()),
        'note', note_text
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_verification_decision on public.user_profiles;
create trigger trg_notify_verification_decision
after update of verification_status on public.user_profiles
for each row
execute function public.notify_verification_decision();

notify pgrst, 'reload schema';
