-- 018_discount_codes.sql
-- Purpose: Discount/Promo code management system for promotional campaigns

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  discount_type text not null default 'percentage', -- 'percentage' or 'fixed'
  discount_value numeric(10, 2) not null check (discount_value > 0),
  max_uses integer check (max_uses is null or max_uses > 0), -- null = unlimited
  current_uses integer not null default 0 check (current_uses >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean not null default true,
  min_booking_amount numeric(10, 2) check (min_booking_amount is null or min_booking_amount >= 0),
  max_discount_amount numeric(10, 2) check (max_discount_amount is null or max_discount_amount > 0), -- max cap for % discount
  applicable_vehicles uuid[] default null, -- null = all vehicles
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_dates_check check (valid_until >= valid_from),
  constraint code_format_check check (code ~ '^[A-Z0-9_-]{3,20}$')
);

-- Create indexes for performance
create index if not exists idx_discount_codes_code on public.discount_codes(code);
create index if not exists idx_discount_codes_active on public.discount_codes(is_active, valid_from, valid_until);
create index if not exists idx_discount_codes_created_by on public.discount_codes(created_by);

-- Trigger to update updated_at on changes
create or replace function public.set_updated_at_discount_codes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_discount_codes_set_updated_at on public.discount_codes;
create trigger trg_discount_codes_set_updated_at
before update on public.discount_codes
for each row
execute function public.set_updated_at_discount_codes();

-- RLS Policies
alter table public.discount_codes enable row level security;

-- Admin can read all discount codes
create policy "discount_codes_admin_read" on public.discount_codes
for select
to authenticated
using (
  auth.uid() in (select user_id from public.admin_users)
);

-- Admin can insert discount codes
create policy "discount_codes_admin_insert" on public.discount_codes
for insert
to authenticated
with check (
  auth.uid() in (select user_id from public.admin_users)
  and created_by = auth.uid()
);

-- Admin can update discount codes they created
create policy "discount_codes_admin_update" on public.discount_codes
for update
to authenticated
using (
  auth.uid() in (select user_id from public.admin_users)
  and created_by = auth.uid()
)
with check (
  auth.uid() in (select user_id from public.admin_users)
  and created_by = auth.uid()
);

-- Admin can delete discount codes they created
create policy "discount_codes_admin_delete" on public.discount_codes
for delete
to authenticated
using (
  auth.uid() in (select user_id from public.admin_users)
  and created_by = auth.uid()
);

-- Public users can read active discount codes (for validation)
create policy "discount_codes_public_read_active" on public.discount_codes
for select
to authenticated
using (
  is_active = true
  and valid_from <= now()
  and valid_until >= now()
);

-- Function to validate and apply discount code
create or replace function public.validate_discount_code(
  p_code text,
  p_booking_amount numeric
)
returns table (
  valid boolean,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  error_message text
) as $$
declare
  v_code record;
  v_discount_amount numeric;
  v_error_message text := '';
begin
  -- Fetch the discount code
  select * into v_code
  from public.discount_codes
  where code = upper(trim(p_code))
  limit 1;

  -- Validate code exists
  if not found then
    return query select false::boolean, null::text, null::numeric, 0::numeric, 'Code not found'::text;
    return;
  end if;

  -- Validate code is active
  if v_code.is_active = false then
    return query select false::boolean, null::text, null::numeric, 0::numeric, 'Code is not active'::text;
    return;
  end if;

  -- Validate date range
  if now() < v_code.valid_from or now() > v_code.valid_until then
    return query select false::boolean, null::text, null::numeric, 0::numeric, 'Code has expired or not yet valid'::text;
    return;
  end if;

  -- Validate usage limit
  if v_code.max_uses is not null and v_code.current_uses >= v_code.max_uses then
    return query select false::boolean, null::text, null::numeric, 0::numeric, 'Code has reached max usage limit'::text;
    return;
  end if;

  -- Validate minimum booking amount
  if v_code.min_booking_amount is not null and p_booking_amount < v_code.min_booking_amount then
    return query select false::boolean, null::text, null::numeric, 0::numeric, 
      'Booking amount is below minimum required: NPR ' || v_code.min_booking_amount::text::text;
    return;
  end if;

  -- Calculate discount amount
  if v_code.discount_type = 'percentage' then
    v_discount_amount := (p_booking_amount * v_code.discount_value / 100);
    if v_code.max_discount_amount is not null then
      v_discount_amount := least(v_discount_amount, v_code.max_discount_amount);
    end if;
  else -- fixed amount
    v_discount_amount := v_code.discount_value;
  end if;

  -- Ensure discount doesn't exceed booking amount
  v_discount_amount := least(v_discount_amount, p_booking_amount);

  return query select true::boolean, v_code.discount_type, v_code.discount_value, v_discount_amount::numeric, ''::text;
end;
$$ language plpgsql stable;

-- Function to apply discount code (increments usage)
create or replace function public.apply_discount_code(p_code text)
returns void as $$
begin
  update public.discount_codes
  set current_uses = current_uses + 1
  where code = upper(trim(p_code))
    and max_uses is null or current_uses < max_uses;
end;
$$ language plpgsql;

revoke all on function public.validate_discount_code(text, numeric) from public;
grant execute on function public.validate_discount_code(text, numeric) to authenticated;

revoke all on function public.apply_discount_code(text) from public;
grant execute on function public.apply_discount_code(text) to authenticated;

notify pgrst, 'reload schema';
