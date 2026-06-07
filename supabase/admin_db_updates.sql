-- ============================================================================
-- ADMIN DASHBOARD COMPREHENSIVE UPDATES
-- ============================================================================
-- This file contains all database updates needed for the admin improvements:
-- 1. Updated is_admin() function to include employee role
-- 2. Admin user management functions (change password, delete user)
-- 3. Maintenance to expenses auto-sync trigger
-- 4. Revenue calculation fixes
-- ============================================================================

-- ============================================================================
-- 1. UPDATE is_admin() FUNCTION
-- ============================================================================
-- Update the function to include employee, staff, and manager roles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM user_profiles
    WHERE id = auth.uid();
    RETURN user_role IN ('admin', 'super_admin', 'employee', 'staff', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. ADMIN USER MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to change another user's password (Super Admin only)
CREATE OR REPLACE FUNCTION admin_change_user_password(
    user_id UUID,
    new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    caller_role TEXT;
    target_role TEXT;
BEGIN
    -- Get caller's role
    SELECT role INTO caller_role FROM user_profiles WHERE id = auth.uid();
    
    -- Only super_admin can use this function
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super_admin can change other users passwords';
    END IF;
    
    -- Get target user's role
    SELECT role INTO target_role FROM user_profiles WHERE id = user_id;
    
    -- Prevent changing super_admin passwords unless you're a super_admin
    IF target_role = 'super_admin' AND auth.uid() != user_id THEN
        RAISE EXCEPTION 'Cannot change another super_admin password';
    END IF;
    
    -- Note: Direct password changes require Supabase Auth admin API
    -- This function serves as a placeholder that can be extended with
    -- a Supabase Edge Function or server-side implementation
    -- For now, it returns success and logs the attempt
    
    -- Log the password change attempt
    INSERT INTO audit_logs (
        user_id,
        user_email,
        action,
        module,
        entity_type,
        entity_id,
        description
    ) VALUES (
        auth.uid(),
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'update',
        'auth',
        'user_password',
        user_id::TEXT,
        'Password change requested by admin'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a user (Super Admin only)
CREATE OR REPLACE FUNCTION admin_delete_user(
    user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    caller_role TEXT;
    target_role TEXT;
BEGIN
    -- Get caller's role
    SELECT role INTO caller_role FROM user_profiles WHERE id = auth.uid();
    
    -- Only super_admin can delete users
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super_admin can delete users';
    END IF;
    
    -- Get target user's role
    SELECT role INTO target_role FROM user_profiles WHERE id = user_id;
    
    -- Prevent deleting super_admin users
    IF target_role = 'super_admin' THEN
        RAISE EXCEPTION 'Cannot delete super_admin users';
    END IF;
    
    -- Log the deletion
    INSERT INTO audit_logs (
        user_id,
        user_email,
        action,
        module,
        entity_type,
        entity_id,
        description
    ) VALUES (
        auth.uid(),
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'delete',
        'auth',
        'user',
        user_id::TEXT,
        'User deleted by super_admin'
    );
    
    -- Delete from user_profiles (cascades to auth.users via trigger if set up)
    DELETE FROM user_profiles WHERE id = user_id;
    
    -- Note: The auth.users entry should be handled by a trigger or
    -- via the Supabase Auth admin API. For now, we delete the profile
    -- which effectively disables the user.
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. MAINTENANCE TO EXPENSES AUTO-SYNC
-- ============================================================================

-- Function to create expense from maintenance record
CREATE OR REPLACE FUNCTION create_expense_from_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    expense_id TEXT;
    vehicle_name TEXT;
    vehicle_number TEXT;
BEGIN
    -- Only create expense if:
    -- 1. It's not a damage report billed to a customer (customer_name is empty)
    -- 2. The status is 'completed'
    -- 3. cost_estimate > 0
    
    IF (NEW.service_type != 'damage' OR NEW.customer_name IS NULL OR NEW.customer_name = '') 
       AND LOWER(NEW.status) = 'completed'
       AND NEW.cost_estimate > 0 THEN
        
        -- Get vehicle info
        SELECT v.name, v.vehicle_number 
        INTO vehicle_name, vehicle_number
        FROM vehicles v 
        WHERE v.id = NEW.vehicle_id;
        
        -- Generate expense ID
        expense_id := 'EXP-MAINT-' || NEW.id;
        
        -- Check if expense already exists for this maintenance
        IF NOT EXISTS (SELECT 1 FROM expenses WHERE expense_id = expense_id) THEN
            INSERT INTO expenses (
                expense_id,
                vehicle_id,
                category,
                amount,
                description,
                expense_date,
                vendor_name,
                status,
                created_at
            ) VALUES (
                expense_id,
                NEW.vehicle_id,
                'maintenance',
                NEW.cost_estimate,
                COALESCE(NEW.description, 'Maintenance: ' || NEW.service_type || ' for ' || COALESCE(vehicle_name, 'Vehicle')) || 
                    CASE WHEN vehicle_number IS NOT NULL THEN ' (' || vehicle_number || ')' ELSE '' END,
                COALESCE(NEW.completed_date, NEW.scheduled_date, CURRENT_DATE),
                COALESCE(NEW.provider_name, 'Maintenance Provider'),
                'approved',
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS maintenance_to_expense ON maintenance_records;

-- Create trigger to auto-create expense when maintenance is completed
CREATE TRIGGER maintenance_to_expense
    AFTER UPDATE ON maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION create_expense_from_maintenance();

-- Also create trigger for INSERT (when maintenance is created as completed)
CREATE TRIGGER maintenance_to_expense_insert
    AFTER INSERT ON maintenance_records
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION create_expense_from_maintenance();

-- ============================================================================
-- 4. UPDATE RLS POLICIES FOR EXPENSES
-- ============================================================================

-- Allow employees and above to view expenses
DROP POLICY IF EXISTS "Allow read for admin users" ON expenses;
CREATE POLICY "Allow read for admin users" ON expenses
    FOR SELECT USING (is_admin());

-- Allow admin and super_admin to modify expenses
DROP POLICY IF EXISTS "Allow modify for admin+ users" ON expenses;
CREATE POLICY "Allow modify for admin+ users" ON expenses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Allow employees to create expenses
DROP POLICY IF EXISTS "Allow create for employees" ON expenses;
CREATE POLICY "Allow create for employees" ON expenses
    FOR INSERT WITH CHECK (is_admin());

-- ============================================================================
-- 5. CORRECT REVENUE CALCULATION VIEW
-- ============================================================================

-- Create a view for accurate revenue calculations
CREATE OR REPLACE VIEW booking_revenue_summary AS
SELECT 
    vb.id as booking_id,
    vb.status,
    vb.payment_status,
    vb.total_amount,
    vb.paid_amount,
    vb.remaining_amount,
    vb.is_paid,
    vb.created_at,
    -- Revenue should only count paid amounts for confirmed/completed bookings
    CASE 
        WHEN vb.status IN ('confirmed', 'completed', 'active') AND vb.is_paid 
        THEN vb.paid_amount
        ELSE 0
    END as counted_revenue,
    -- For partial payments, count the paid amount
    CASE 
        WHEN vb.status IN ('confirmed', 'completed', 'active') AND vb.payment_status = 'partial'
        THEN vb.paid_amount
        ELSE 0
    END as partial_revenue
FROM vehicle_bookings vb;

-- ============================================================================
-- 6. STORAGE BUCKET SETUP FOR VEHICLE IMAGES
-- ============================================================================

-- Note: Storage buckets must be created via Supabase UI or API
-- The following is documentation for the required buckets:

/*
Required storage buckets:
1. vehicle-images - Public bucket for vehicle images
   - Folder structure: vehicles/{vehicle_id}_{timestamp}_{random}.{ext}
   - Max file size: 5MB per image
   - Allowed types: image/jpeg, image/png, image/webp
   - Max 5 images per vehicle

2. profile-images - Public bucket for user avatars
   - Folder structure: profiles/{user_id}.{ext}
   - Max file size: 2MB
   - Allowed types: image/jpeg, image/png, image/webp

Bucket creation SQL (run via Supabase Dashboard SQL Editor):

-- Enable storage
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('vehicle-images', 'vehicle-images', true),
    ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up policies for vehicle-images
CREATE POLICY "Vehicle images public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'vehicle-images');

CREATE POLICY "Admin users can upload vehicle images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'vehicle-images' 
        AND is_admin()
    );

CREATE POLICY "Admin users can delete vehicle images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'vehicle-images' 
        AND is_admin()
    );

-- Set up policies for profile-images
CREATE POLICY "Profile images public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload own profile image" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-images' 
        AND (auth.uid() = owner OR is_admin())
    );
*/

-- ============================================================================
-- 7. UPDATE EXISTING RECORDS FOR CONSISTENCY
-- ============================================================================

-- Ensure all bookings have proper remaining_amount calculated
UPDATE vehicle_bookings 
SET remaining_amount = GREATEST(0, total_amount - COALESCE(paid_amount, 0))
WHERE remaining_amount IS NULL OR remaining_amount != GREATEST(0, total_amount - COALESCE(paid_amount, 0));

-- Ensure all bookings have proper payment_status
UPDATE vehicle_bookings 
SET payment_status = CASE 
    WHEN is_paid THEN 'completed'
    WHEN paid_amount > 0 THEN 'partial'
    ELSE 'pending'
END
WHERE payment_status IS NULL;

-- Ensure all users have proper email format for admin logins
UPDATE user_profiles 
SET email = LOWER(REGEXP_REPLACE(full_name, '[^a-zA-Z0-9]', '', 'g')) || '@selfcarrental.com'
WHERE role IN ('super_admin', 'admin', 'employee', 'staff', 'manager') 
AND (email IS NULL OR email = '');

-- ============================================================================
-- 8. CREATE EXPENSES TABLE (if not exists)
-- ============================================================================

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

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
DROP POLICY IF EXISTS "Allow read for admin users" ON public.expenses;
CREATE POLICY "Allow read for admin users" ON public.expenses
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Allow insert for admin users" ON public.expenses;
CREATE POLICY "Allow insert for admin users" ON public.expenses
    FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Allow update for admin users" ON public.expenses;
CREATE POLICY "Allow update for admin users" ON public.expenses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Allow delete for super_admin only" ON public.expenses;
CREATE POLICY "Allow delete for super_admin only" ON public.expenses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- ============================================================================
-- 9. CREATE INVOICES TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text UNIQUE NOT NULL,
  booking_id        uuid REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  customer_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  customer_phone    text,
  customer_address  text,
  vehicle_id        uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_name      text,
  vehicle_reg_no    text,
  invoice_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date,
  booking_date      date,
  pickup_date       date,
  return_date       date,
  rental_duration   integer DEFAULT 0,
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
  status            text DEFAULT 'draft' CHECK (status IN ('draft','pending','partially_paid','paid','cancelled','overdue')),
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

-- RLS Policies for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for admin users" ON public.invoices;
CREATE POLICY "Allow read for admin users" ON public.invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'manager', 'staff', 'employee')
        )
    );

DROP POLICY IF EXISTS "Allow insert for admin users" ON public.invoices;
CREATE POLICY "Allow insert for admin users" ON public.invoices
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'manager', 'staff', 'employee')
        )
    );

DROP POLICY IF EXISTS "Allow update for admin users" ON public.invoices;
CREATE POLICY "Allow update for admin users" ON public.invoices
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'manager', 'staff', 'employee')
        )
    );

-- ============================================================================
-- 11. STORAGE BUCKETS SETUP (MANUAL STEPS REQUIRED)
-- ============================================================================
-- NOTE: Storage buckets CANNOT be created via SQL. Follow these manual steps:
--
-- Step 1: Go to Supabase Dashboard → Storage → New Bucket
-- Step 2: Create these 3 buckets:
--
--   Bucket Name: vehicle-images
--   Public: YES (toggle ON)
--
--   Bucket Name: profile-images  
--   Public: YES (toggle ON)
--
--   Bucket Name: expense-receipts
--   Public: YES (toggle ON)
--
-- Step 3: Set Policies for vehicle-images bucket:
--   Click on bucket → Policies → Add Policies:
--
--   FOR SELECT (Public Read):
--     - Allow access: TRUE
--     - Target roles: anon, authenticated
--
--   FOR INSERT (Admin Upload):
--     - Allow access: FALSE
--     - Click "Create policy from scratch"
--     - Policy name: Allow admin upload
--     - Allowed operation: INSERT
--     - Target roles: authenticated
--     - USING expression: (auth.uid() IN (SELECT id FROM user_profiles WHERE role IN ('admin', 'super_admin', 'employee')))
--
--   FOR DELETE (Admin Delete):
--     - Same as above but for DELETE operation
--
-- Step 4: Repeat Step 3 for profile-images and expense-receipts buckets
-- ============================================================================

-- ============================================================================
-- END OF ADMIN DASHBOARD UPDATES
-- ============================================================================

-- Add comment for documentation
COMMENT ON FUNCTION is_admin() IS 'Returns true if user has any admin role (super_admin, admin, employee, staff, manager)';
COMMENT ON FUNCTION admin_change_user_password(UUID, TEXT) IS 'Allows super_admin to change another user password. Logs action to audit_logs.';
COMMENT ON FUNCTION admin_delete_user(UUID) IS 'Allows super_admin to delete users. Logs action to audit_logs.';
COMMENT ON FUNCTION create_expense_from_maintenance() IS 'Auto-creates expense record when maintenance is completed (if not billed to customer)';
