-- 033_rls_admin_role_enforcement.sql
-- Purpose: Enforce admin-only access on write operations for admin-managed tables.
-- Previously, any authenticated user could INSERT/UPDATE/DELETE on drivers,
-- maintenance_records, damage_bills, and contact_messages. This migration
-- replaces those permissive policies with admin-role-checked policies.

-- ── Helper: reusable admin check ─────────────────────────────────────────────
-- Returns true if the calling user is an active admin.
drop function if exists public.is_admin_user() cascade;
drop function if exists public.is_admin_user(uuid) cascade;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DRIVERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

drop policy if exists "Authenticated users can insert drivers" on public.drivers;
drop policy if exists "Authenticated users can update drivers" on public.drivers;
drop policy if exists "Authenticated users can delete drivers" on public.drivers;

create policy "Admins can insert drivers"
  on public.drivers for insert
  to authenticated
  with check (public.is_admin_user());

create policy "Admins can update drivers"
  on public.drivers for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "Admins can delete drivers"
  on public.drivers for delete
  to authenticated
  using (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MAINTENANCE_RECORDS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

drop policy if exists "Authenticated users can insert maintenance records" on public.maintenance_records;
drop policy if exists "Authenticated users can update maintenance records" on public.maintenance_records;
drop policy if exists "Authenticated users can delete maintenance records" on public.maintenance_records;

create policy "Admins can insert maintenance records"
  on public.maintenance_records for insert
  to authenticated
  with check (public.is_admin_user());

create policy "Admins can update maintenance records"
  on public.maintenance_records for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "Admins can delete maintenance records"
  on public.maintenance_records for delete
  to authenticated
  using (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. DAMAGE_BILLS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

drop policy if exists "Authenticated full access to damage_bills" on public.damage_bills;

create policy "Admins can manage damage_bills"
  on public.damage_bills for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CONTACT_MESSAGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Keep anonymous + authenticated INSERT (contact form submission)
-- Restrict SELECT/UPDATE/DELETE to admins only

drop policy if exists "Authenticated users can read contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can update contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can delete contact messages" on public.contact_messages;

create policy "Admins can read contact messages"
  on public.contact_messages for select
  to authenticated
  using (public.is_admin_user());

create policy "Admins can update contact messages"
  on public.contact_messages for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "Admins can delete contact messages"
  on public.contact_messages for delete
  to authenticated
  using (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. VEHICLES TABLE — restrict write to admins
-- ═══════════════════════════════════════════════════════════════════════════════

drop policy if exists "Public can manage vehicles" on public.vehicles;

create policy "Admins can manage vehicles"
  on public.vehicles for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. VEHICLE_BOOKINGS TABLE — restrict SELECT to owner + admins
-- ═══════════════════════════════════════════════════════════════════════════════

drop policy if exists "Public can read vehicle bookings" on public.vehicle_bookings;

create policy "Owners and admins can read vehicle bookings"
  on public.vehicle_bookings for select
  to authenticated
  using (
    customer_user_id = auth.uid()
    or public.is_admin_user()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. MISSING INDEXES for performance
-- ═══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_notifications_user_unread_admin
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists idx_vehicle_locations_vehicle_recorded
  on public.vehicle_locations (vehicle_id, recorded_at desc);
