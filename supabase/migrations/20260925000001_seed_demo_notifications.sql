-- ============================================================
-- SEED — tidy the demo account's Notifications screen.
-- ============================================================
--
-- on_member_join writes a 'join' event for EVERY project_members insert, and
-- the notifications screen lists every join event on a project you own,
-- marking it approved only when a matching mou_signed event carrying
-- metadata.approved_for exists.
--
-- The demo seed therefore produced about a dozen "wants to join" rows,
-- including the demo user apparently asking to join their own projects. This
-- leaves exactly two genuine pending requests:
--
--   Advaith -> Lumen (Backend Dev)
--   Goutam  -> Lumen (Marketing)
--
-- ...by deleting the owner's self-join events and approving everyone else.
-- ============================================================

DO $$
DECLARE
  demo    uuid := '81dd1cfb-6aab-4c72-afac-ec4686cecb85';
  advaith uuid := 'fa57d1e4-c3db-4745-b98f-a650299e1ea0';
  goutam  uuid := '3ad9adc4-b86d-456f-8b7c-6fba0abb4e2a';
  p_lumen uuid := 'dec0de00-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = demo) THEN
    RETURN;
  END IF;

  -- An owner never "requests to join" their own project.
  DELETE FROM public.collaboration_events e
   USING public.projects p
   WHERE p.id = e.project_id
     AND p.owner_id = demo
     AND e.user_id  = demo
     AND e.event_type = 'join';

  -- Approve every remaining joiner except the two meant to stay outstanding.
  -- The approval marker is a mou_signed event written by the owner whose
  -- metadata names the member it approves -- same shape the app writes.
  INSERT INTO public.collaboration_events (project_id, user_id, event_type, metadata, created_at)
  SELECT e.project_id,
         demo,
         'mou_signed',
         jsonb_build_object('approved_for', e.user_id),
         e.created_at + interval '2 hours'
    FROM public.collaboration_events e
    JOIN public.projects p ON p.id = e.project_id
   WHERE p.owner_id = demo
     AND e.event_type = 'join'
     AND NOT (e.project_id = p_lumen AND e.user_id IN (advaith, goutam))
     AND NOT EXISTS (
       SELECT 1 FROM public.collaboration_events a
        WHERE a.project_id = e.project_id
          AND a.user_id = demo
          AND a.event_type = 'mou_signed'
          AND a.metadata ->> 'approved_for' = e.user_id::text
     );
END $$;
