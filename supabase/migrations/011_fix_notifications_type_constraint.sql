-- ============================================================================
-- 011_fix_notifications_type_constraint.sql
-- Run in Supabase Dashboard → SQL Editor
-- Removes the restrictive notifications_type_check constraint AND updates
-- the contact message trigger to use 'info' type as fallback.
-- ============================================================================

-- 1. Drop the restrictive constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Update the contact message notification trigger to use 'info' type
--    (in case constraint can't be dropped or is recreated later)
CREATE OR REPLACE FUNCTION public.notify_admin_contact_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
BEGIN
  FOR admin_row IN
    SELECT id FROM auth.users
    WHERE raw_app_meta_data ->> 'role' = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, is_admin, metadata)
    VALUES (
      admin_row.id,
      'info',
      'New Contact Message',
      'From ' || COALESCE(NEW.name, 'Unknown') || ': ' || COALESCE(NEW.subject, '(no subject)'),
      true,
      jsonb_build_object(
        'contactMessageId', NEW.id,
        'senderName', COALESCE(NEW.name, ''),
        'senderEmail', COALESCE(NEW.email, ''),
        'subject', COALESCE(NEW.subject, '')
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

SELECT 'notifications constraint removed + contact trigger updated' AS status;
