-- ============================================================
-- Fix chat_messages RLS.
-- ============================================================
--
-- Two separate defects, both letting any signed-in user read and write every
-- project's chat regardless of membership.
--
-- 1. The original policies used a self-referential predicate:
--
--      auth.uid() in (
--        select user_id from public.project_members where project_id = project_id
--      )
--
--    Both sides of `project_id = project_id` resolve to
--    project_members.project_id, never the chat_messages row being checked, so
--    the comparison is always true and the subquery returns every user_id in
--    the table.
--
-- 2. A later migration (20260323000000) added policies that dropped the
--    membership test altogether:
--
--      "chat: project members read"   USING (true)
--      "chat: authenticated insert"   WITH CHECK (auth.uid() = sender_id)
--
--    Policies are OR'd, so these granted exactly what the stricter ones were
--    meant to withhold, despite their names.
--
-- Verified against the remote database before this fix: the demo account held
-- 6 memberships yet could read messages from 8 projects, and successfully
-- inserted a message into a project it had never joined.
--
-- Replaced with a single correctly-scoped policy per operation, using EXISTS
-- with qualified column names so the predicate cannot silently self-reference.
-- Project owners are included explicitly: owning a project does not require a
-- project_members row.
-- ============================================================

-- Remove the probe row left by the verification above.
DELETE FROM public.chat_messages WHERE content = '__rls_probe__ delete me';

DROP POLICY IF EXISTS "chat_messages: project members can read" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages: project members can send" ON public.chat_messages;
DROP POLICY IF EXISTS "chat: project members read"              ON public.chat_messages;
DROP POLICY IF EXISTS "chat: authenticated insert"              ON public.chat_messages;

CREATE POLICY "chat_messages: members and owner read"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
       WHERE pm.project_id = chat_messages.project_id
         AND pm.user_id    = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id       = chat_messages.project_id
         AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages: members and owner send"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM public.project_members pm
         WHERE pm.project_id = chat_messages.project_id
           AND pm.user_id    = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
         WHERE p.id       = chat_messages.project_id
           AND p.owner_id = auth.uid()
      )
    )
  );
