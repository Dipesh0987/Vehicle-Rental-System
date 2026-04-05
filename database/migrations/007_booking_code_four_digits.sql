-- 007_booking_code_four_digits.sql
-- Purpose: Update booking code format to BK-XXXX (4 random digits) with uniqueness checks.

create or replace function public.generate_vehicle_booking_code()
returns trigger
language plpgsql
as $$
declare
  random_token text;
  candidate_code text;
  max_attempts integer := 100;
  try_count integer := 0;
begin
  if coalesce(trim(new.booking_code), '') <> '' then
    return new;
  end if;

  loop
    random_token := lpad(floor(random() * 10000)::text, 4, '0');
    candidate_code := 'BK-' || random_token;

    if not exists (
      select 1
      from public.vehicle_bookings
      where booking_code = candidate_code
    ) then
      new.booking_code := candidate_code;
      return new;
    end if;

    try_count := try_count + 1;
    if try_count >= max_attempts then
      raise exception 'Unable to generate a unique booking code after % attempts', max_attempts;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
