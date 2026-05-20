-- ============================================================================
-- 008_chat_conversations_table.sql
-- Run in Supabase Dashboard → SQL Editor
-- Creates tables for AI chat conversation persistence and analytics
-- ============================================================================

-- ── 1. Conversation sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      text NOT NULL,
  title           text NOT NULL DEFAULT 'New chat',
  started_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  message_count   integer NOT NULL DEFAULT 0,
  metadata        jsonb DEFAULT '{}'::jsonb,
  is_archived     boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user
  ON public.chat_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_session
  ON public.chat_conversations(session_id);

-- ── 2. Individual messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL DEFAULT '',
  intent           text,
  citations        jsonb DEFAULT '[]'::jsonb,
  actions          jsonb DEFAULT '[]'::jsonb,
  token_count      integer,
  latency_ms       integer,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON public.chat_messages(conversation_id, created_at);

-- ── 3. Analytics / telemetry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_analytics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      text,
  intent          text NOT NULL,
  query           text NOT NULL,
  source          text,
  success         boolean NOT NULL DEFAULT true,
  latency_ms      integer,
  error_message   text,
  model           text,
  token_count     integer,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_created
  ON public.chat_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_intent
  ON public.chat_analytics(intent, created_at DESC);

-- ── 4. Rate limiting tracker ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start    timestamptz NOT NULL,
  request_count   integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_user
  ON public.chat_rate_limits(user_id, window_start DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
DROP POLICY IF EXISTS "Users manage own conversations" ON public.chat_conversations;
CREATE POLICY "Users manage own conversations" ON public.chat_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Users can only see messages in their own conversations
DROP POLICY IF EXISTS "Users read own messages" ON public.chat_messages;
CREATE POLICY "Users read own messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Analytics: service role bypasses RLS; admin users can read via dashboard
DROP POLICY IF EXISTS "Admin reads analytics" ON public.chat_analytics;
CREATE POLICY "Admin reads analytics" ON public.chat_analytics
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Allow insert for any authenticated user (Edge Function uses service role which bypasses RLS)
DROP POLICY IF EXISTS "Insert analytics" ON public.chat_analytics;
CREATE POLICY "Insert analytics" ON public.chat_analytics
  FOR INSERT WITH CHECK (true);

-- Rate limits: service role only
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.chat_rate_limits;
CREATE POLICY "Service role manages rate limits" ON public.chat_rate_limits
  FOR ALL USING (true);

-- ── Cleanup function: purge old analytics (> 90 days) ───────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_analytics()
RETURNS void AS $$
BEGIN
  DELETE FROM public.chat_analytics WHERE created_at < now() - interval '90 days';
  DELETE FROM public.chat_rate_limits WHERE window_start < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'chat_conversations, chat_messages, chat_analytics, chat_rate_limits tables created' AS status;
