-- ============================================================
-- project_members has no DELETE policy, so nobody can leave a project.
-- ============================================================
--
-- There are two "initial schema" migrations in this history and both are
-- recorded as applied. Only 20260323000000 is actually live: its policy names
-- ("members: public read", "members: own insert", "members: own update") are
-- the ones on the table, and it defines no DELETE policy at all.
-- 20260321000000 -- which does define "project_members: owner can remove
-- members" -- left nothing behind.
--
-- With RLS enabled and no DELETE policy, every delete matches zero rows.
-- PostgREST reports that as success, so "Quit Project" has never worked: the
-- client navigated away, posted its system message, and left the membership
-- row in place. Coming back put the user straight back in the project. That is
-- the other half of the reported "leaving doesn't really make the exit" --
-- the chat RLS fix in 20260930000000 closed the "still can text" half.
--
-- Verified against the remote database before this migration: the demo account
-- could delete neither its own membership nor, as project owner, anyone
-- else's. Both returned HTTP 200 with an empty result and left the row intact.
--
-- Predicates use EXISTS with qualified column names. The unqualified form
-- (`where id = project_id`) is what made the original chat policies always-true.
-- ============================================================

DROP POLICY IF EXISTS "project_members: owner can remove members" ON public.project_members;
DROP POLICY IF EXISTS "members: self or owner delete"             ON public.project_members;

CREATE POLICY "members: self or owner delete"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id       = project_members.project_id
         AND p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- collaboration_events could not record a removal.
-- ============================================================
--
-- "events: authenticated insert" is WITH CHECK (auth.uid() = user_id). A
-- removal's subject is the member being removed, not the owner doing it, so
-- writing that audit row returned 42501. Logging it against the owner instead
-- would put the wrong user_id in the log the PVS engine reads.
--
-- Widened to: you may log an event about yourself, or about anyone on a
-- project you own. Still no UPDATE or DELETE policy, so the log stays
-- append-only.

DROP POLICY IF EXISTS "events: authenticated insert" ON public.collaboration_events;
DROP POLICY IF EXISTS "events: self or owner insert" ON public.collaboration_events;

CREATE POLICY "events: self or owner insert"
  ON public.collaboration_events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id       = collaboration_events.project_id
         AND p.owner_id = auth.uid()
    )
  );
