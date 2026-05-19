-- ============================================================================
-- 006_contact_messages_table.sql
-- Run in Supabase Dashboard → SQL Editor
-- Creates contact_messages table + admin notification trigger
-- ============================================================================

-- ── 1. contact_messages table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  subject    text NOT NULL DEFAULT '',
  message    text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'unread',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can insert a contact message
DROP POLICY IF EXISTS "Anyone can send contact message" ON public.contact_messages;
CREATE POLICY "Anyone can send contact message" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

-- Admin can read, update, delete all contact messages
DROP POLICY IF EXISTS "Admin manages contact messages" ON public.contact_messages;
CREATE POLICY "Admin manages contact messages" ON public.contact_messages
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR public.is_admin_user()
  );


-- ── 2. Trigger: notify admin when a new contact message arrives ─────────────
CREATE OR REPLACE FUNCTION public.notify_admin_contact_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
BEGIN
  -- Insert a notification for EVERY admin user
  FOR admin_row IN
    SELECT id FROM auth.users
    WHERE raw_app_meta_data ->> 'role' = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, is_admin, metadata)
    VALUES (
      admin_row.id,
      'contact_message',
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

DROP TRIGGER IF EXISTS on_contact_message_notify_admin ON public.contact_messages;
CREATE TRIGGER on_contact_message_notify_admin
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_contact_message();


-- ── 3. Enable realtime for contact_messages ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'contact_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'contact_messages table + admin notification trigger created' AS status;
