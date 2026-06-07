-- Fix RLS for payments table (for guest payments)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create payment records
DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;
CREATE POLICY "Anyone can create payments" 
ON public.payments 
FOR INSERT 
TO PUBLIC 
WITH CHECK (true);

-- Allow anyone to view their own payments (by booking_id)
DROP POLICY IF EXISTS "Anyone can view payments" ON public.payments;
CREATE POLICY "Anyone can view payments" 
ON public.payments 
FOR SELECT 
TO PUBLIC 
USING (true);

-- Allow anyone to update payment (for receipt upload)
DROP POLICY IF EXISTS "Anyone can update payments" ON public.payments;
CREATE POLICY "Anyone can update payments" 
ON public.payments 
FOR UPDATE 
TO PUBLIC 
USING (true);

-- Fix storage bucket RLS for payment-receipts
-- Allow anyone to upload receipts
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads" 
ON storage.objects 
FOR INSERT 
TO PUBLIC 
WITH CHECK (bucket_id = 'payment-receipts');

-- Allow anyone to view receipts
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
CREATE POLICY "Allow public read" 
ON storage.objects 
FOR SELECT 
TO PUBLIC 
USING (bucket_id = 'payment-receipts');

COMMENT ON POLICY "Anyone can create payments" ON public.payments IS 'Allows guest users to create payment records';
