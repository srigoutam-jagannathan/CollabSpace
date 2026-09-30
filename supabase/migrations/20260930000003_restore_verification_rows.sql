-- Restores the two project_members rows deleted while verifying
-- 20260930000002 against the remote database.
--
-- That migration added the missing DELETE policy, and the only honest way to
-- confirm it worked was to delete real rows through PostgREST as the demo user
-- (migrations run as superuser and bypass RLS entirely, so they cannot test a
-- policy). Both rows are restored here with their original ids and timestamps,
-- captured before the deletes.
--
-- Also removes the audit rows those deletes produced: the 'member_removed'
-- event written to check the widened collaboration_events insert policy, and
-- the 'join' events that on_member_join will fire as these rows go back in --
-- the members never re-joined, so those events would be fiction in a log the
-- PVS engine treats as fact.

INSERT INTO public.project_members
  (id, created_at, project_id, user_id, role, intro_message, mou_accepted, mou_accepted_at)
VALUES
  ('96fa2899-0dce-4bed-a922-8006c47de0ae', '2026-09-25T11:14:07.266272+00',
   'ea93bb84-5f6c-44b6-98c4-8b6ceb005990', '81dd1cfb-6aab-4c72-afac-ec4686cecb85',
   'Designer', NULL, TRUE, NULL),
  ('e684c443-1334-496c-accd-e3132ada4df5', '2026-09-27T19:39:17.007705+00',
   'dec0de00-0000-4000-8000-000000000001', 'bf8bb622-7805-4a11-b026-618ee1680ed0',
   'Designer', 'Jnbvgh', FALSE, NULL)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- The probe event from the policy check.
DELETE FROM public.collaboration_events
 WHERE id = 'f4fb4b8d-a507-449d-9e71-12219a89a7fc';

-- Join events the trigger just fabricated for the two restored rows.
DELETE FROM public.collaboration_events
 WHERE event_type = 'join'
   AND created_at > now() - interval '10 minutes'
   AND (project_id, user_id) IN (
     ('ea93bb84-5f6c-44b6-98c4-8b6ceb005990', '81dd1cfb-6aab-4c72-afac-ec4686cecb85'),
     ('dec0de00-0000-4000-8000-000000000001', 'bf8bb622-7805-4a11-b026-618ee1680ed0')
   );
