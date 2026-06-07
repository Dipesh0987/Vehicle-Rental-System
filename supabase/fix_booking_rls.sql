-- Fix RLS policies to allow guest bookings
-- This allows anyone to create a booking (guest or logged in)

-- Enable RLS on bookings if not already enabled
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Allow guest bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

-- Create new policy that allows anyone to insert bookings
CREATE POLICY "Anyone can create bookings" 
ON public.bookings 
FOR INSERT 
TO PUBLIC 
WITH CHECK (true);

-- Allow anyone to view bookings (for checking availability)
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;
CREATE POLICY "Anyone can view bookings" 
ON public.bookings 
FOR SELECT 
TO PUBLIC 
USING (true);

-- Only allow admins or the booking owner to update
DROP POLICY IF EXISTS "Only admins can update bookings" ON public.bookings;
CREATE POLICY "Only admins can update bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
  OR user_id = auth.uid()
);

-- Allow service role to do everything
DROP POLICY IF EXISTS "Service role full access" ON public.bookings;
CREATE POLICY "Service role full access" 
ON public.bookings 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

COMMENT ON POLICY "Anyone can create bookings" ON public.bookings IS 'Allows guest users to create bookings without login';
