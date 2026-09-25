-- ============================================================
-- SEED — Demo preview data.  NOT schema.  Safe to delete.
-- ============================================================
--
-- Populates every screen for the demo account so the UI can be reviewed at
-- realistic density instead of through empty states.
--
--   demo@qub.ac.uk  /  CollabDemo2026!
--   81dd1cfb-6aab-4c72-afac-ec4686cecb85
--
-- Also restores three archive projects (Tidewater, Kestrel, Foghorn) deleted
-- since the previous seed. Without them only three completed projects remain,
-- below the Shipped rail's five-project gate, so the rail -- and the only
-- doorway into the Archive deck -- stays hidden.
--
-- Only the four profiles that currently exist are referenced. An earlier
-- draft of this file referenced six accounts that had since been deleted and
-- failed on projects_owner_id_fkey.
--
-- Guarded: no-ops entirely if the demo auth user is absent, so a fresh
-- environment replaying migrations does not fail on a missing foreign key.
--
-- TEARDOWN (leaves the auth user; remove that in the Supabase dashboard):
--   delete from public.projects  where 'seed:demo-preview'    = any(tags);
--   delete from public.projects  where 'seed:archive-preview' = any(tags);
--   delete from public.connections
--     where requester_id = '81dd1cfb-6aab-4c72-afac-ec4686cecb85'
--        or recipient_id = '81dd1cfb-6aab-4c72-afac-ec4686cecb85';
-- ============================================================

DO $$
DECLARE
  demo    uuid := '81dd1cfb-6aab-4c72-afac-ec4686cecb85';  -- Demo Student
  john    uuid := 'b3abbc81-69b3-4995-a301-c9adb59c3908';  -- John, QUB
  advaith uuid := 'fa57d1e4-c3db-4745-b98f-a650299e1ea0';  -- Advaith, QUB
  goutam  uuid := '3ad9adc4-b86d-456f-8b7c-6fba0abb4e2a';  -- Goutam, QUB
  johnu   uuid := 'bf8bb622-7805-4a11-b026-618ee1680ed0';  -- John, Ulster

  p_lumen uuid := 'dec0de00-0000-4000-8000-000000000001';  -- demo owns, recruiting
  p_field uuid := 'dec0de00-0000-4000-8000-000000000002';  -- demo owns, active
  p_night uuid := 'dec0de00-0000-4000-8000-000000000003';  -- demo owns, completed
  p_pulp  uuid := 'ea93bb84-5f6c-44b6-98c4-8b6ceb005990';  -- demo joins this
  p_beers uuid := '0a8ab0ff-2b23-4bb1-bca3-573281d5b0ba';  -- demo is invited to
  c_gout  uuid := 'c04eec70-0000-4000-8000-000000000002';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = demo) THEN
    RAISE NOTICE 'demo user absent - skipping demo seed';
    RETURN;
  END IF;

  -- ── Profile ────────────────────────────────────────────────────────────
  -- 'Designer' deliberately matches Version 2.0 of sidequest's
  -- role_requirements, so the hero renders in matched mode ("Needs your
  -- skills") rather than the recent-projects fallback. Demo must therefore
  -- stay a non-member and non-owner of that project.
  UPDATE public.profiles SET
    full_name       = 'Demo Student',
    department      = 'Computer Science',
    university      = 'qub',
    year_of_study   = 3,
    bio             = 'Third-year CS at Queen''s. Design systems, mapping, and anything that actually ships. Usually in the McClay.',
    skills          = ARRAY['Designer','React Native','Backend Dev','Figma'],
    pvs_score       = 72,
    badges          = ARRAY['first_project','mou_signed'],
    portfolio_links = '[{"label":"GitHub","url":"https://github.com/example"},{"label":"Portfolio","url":"https://example.com"}]'::jsonb
  WHERE id = demo;

  -- ── Restore the deleted archive projects ───────────────────────────────
  INSERT INTO public.projects
    (id, created_at, updated_at, owner_id, title, description, status,
     looking_for, tags, university_scope, project_health, github_repo_url, figma_url)
  VALUES
    ('a5e1d000-0000-4000-8000-000000000001','2025-10-02 09:00:00+00','2026-01-28 16:20:00+00', john,
     'Tidewater',
     'Fifty years of Antrim coastal erosion, mapped and animated from Ordnance Survey scans. Now cited in two Geography dissertations.',
     'completed','{}','{Mapping,"Data Viz","seed:archive-preview"}','both',92.0,
     'https://github.com/example/tidewater','https://figma.com/file/example-tidewater'),
    ('a5e1d000-0000-4000-8000-000000000004','2026-01-15 09:00:00+00','2026-05-07 10:30:00+00', johnu,
     'Kestrel',
     'A searchable archive of drone survey footage for the Built Environment school, replacing 2TB of unlabelled hard drives with tagged, streamable clips.',
     'completed','{}','{Drones,Archive,"seed:archive-preview"}','ulster',81.0,
     NULL,'https://figma.com/file/example-kestrel'),
    ('a5e1d000-0000-4000-8000-000000000006','2026-03-30 09:00:00+00','2026-08-12 12:00:00+00', advaith,
     'Foghorn',
     'A low-bandwidth alerting tool for the marine research station on Rathlin, built to work over a link that drops for hours at a time.',
     'completed','{}','{Offline,Networking,"seed:archive-preview"}','both',76.0,
     'https://github.com/example/foghorn',NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.project_members (project_id, user_id, role, mou_accepted) VALUES
    ('a5e1d000-0000-4000-8000-000000000001', john,    'Lead',        true),
    ('a5e1d000-0000-4000-8000-000000000001', advaith, 'Data',        true),
    ('a5e1d000-0000-4000-8000-000000000001', goutam,  'Designer',    true),
    ('a5e1d000-0000-4000-8000-000000000004', johnu,   'Lead',        true),
    ('a5e1d000-0000-4000-8000-000000000004', john,    'Backend Dev', true),
    ('a5e1d000-0000-4000-8000-000000000006', advaith, 'Lead',        true),
    ('a5e1d000-0000-4000-8000-000000000006', goutam,  'Networking',  true),
    ('a5e1d000-0000-4000-8000-000000000006', johnu,   'Designer',    true)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- ── Demo's own projects ────────────────────────────────────────────────
  INSERT INTO public.projects
    (id, created_at, updated_at, owner_id, title, description, status,
     looking_for, role_requirements, tags, university_scope, project_health,
     github_repo_url, figma_url)
  VALUES
    (p_lumen,'2026-09-08 10:00:00+00','2026-09-22 14:00:00+00', demo,
     'Lumen',
     'A daily check-in app for the SU wellbeing service. Research and interviews are done and the flows are mapped in Figma; it needs building.',
     'recruiting','{}',
     '[{"role":"Backend Dev","description":"Supabase schema and the check-in API"},{"role":"Marketing","description":"Launch across both campuses in freshers week"}]'::jsonb,
     '{Wellbeing,Research,"seed:demo-preview"}','both',64.0,
     'https://github.com/example/lumen','https://figma.com/file/example-lumen'),

    (p_field,'2026-06-11 09:00:00+00','2026-09-24 18:30:00+00', demo,
     'Fieldnotes',
     'Shared field-recording notebook for the Geography department, with offline capture and automatic sync when a signal comes back.',
     'active','{}','[]'::jsonb,
     '{Offline,Mapping,"seed:demo-preview"}','qub',88.0,
     'https://github.com/example/fieldnotes',NULL),

    (p_night,'2025-11-20 09:00:00+00','2026-04-18 15:45:00+00', demo,
     'Nightingale',
     'A rota tool for the student nursing placement office. Cut the weekly scheduling run from about four hours to twenty minutes.',
     'completed','{}','[]'::jsonb,
     '{Scheduling,Health,"seed:demo-preview"}','both',94.0,
     'https://github.com/example/nightingale','https://figma.com/file/example-nightingale')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.project_members (project_id, user_id, role, mou_accepted) VALUES
    (p_lumen, demo,    'Lead',        true),
    (p_lumen, john,    'Designer',    true),
    (p_field, demo,    'Lead',        true),
    (p_field, goutam,  'Data',        true),
    (p_field, johnu,   'Backend Dev', true),
    (p_night, demo,    'Lead',        true),
    (p_night, advaith, 'Backend Dev', true),
    (p_night, johnu,   'Designer',    true)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Demo joins someone else's project, so My Projects has a joined entry and
  -- Chat has a thread demo does not own. Deliberately not sidequest: joining
  -- it would exclude it from Needs your skills, and it is the only project
  -- whose roles match demo's skills.
  INSERT INTO public.project_members (project_id, user_id, role, mou_accepted) VALUES
    (p_pulp, demo, 'Designer', true)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- ── Pending join requests on demo's recruiting project ─────────────────
  -- on_member_join writes the 'join' events these surface from. No matching
  -- mou_signed row carrying approved_for, so they read as outstanding.
  INSERT INTO public.project_members (project_id, user_id, role, mou_accepted) VALUES
    (p_lumen, advaith, 'Backend Dev', false),
    (p_lumen, goutam,  'Marketing',   false)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- ── Connections ────────────────────────────────────────────────────────
  -- requester_id < recipient_id is enforced. Demo's uuid starts '81dd', so
  -- goutam ('3ad9') sorts before it and both Johns ('b3ab','bf8b') after.
  INSERT INTO public.connections (id, requester_id, recipient_id, initiated_by, status) VALUES
    (c_gout, goutam, demo, demo, 'accepted')
  ON CONFLICT (requester_id, recipient_id) DO NOTHING;

  -- Incoming and still pending: initiated_by is the other person, which is
  -- what the notifications screen filters on. Pending connections do not
  -- exclude anyone from People to know, so that rail stays populated.
  INSERT INTO public.connections (requester_id, recipient_id, initiated_by, status) VALUES
    (demo, john,  john,  'pending'),
    (demo, johnu, johnu, 'pending')
  ON CONFLICT (requester_id, recipient_id) DO NOTHING;

  -- ── Direct messages on the accepted connection ─────────────────────────
  INSERT INTO public.direct_messages (connection_id, sender_id, content, created_at) VALUES
    (c_gout, goutam, 'Saw Lumen on Discover. The check-in flow looks really clean.', now() - interval '3 hours'),
    (c_gout, demo,   'Thanks. Still short a backend dev if you know anyone going.',  now() - interval '2 hours 40 minutes'),
    (c_gout, goutam, 'I might be able to help actually. Are you free Thursday?',     now() - interval '2 hours 10 minutes')
  ON CONFLICT DO NOTHING;

  -- ── Collaboration invitation waiting for demo ──────────────────────────
  INSERT INTO public.collab_invitations (project_id, sender_id, recipient_id, role, message, status) VALUES
    (p_beers, advaith, demo, 'Designer', 'We need someone to make this look less like a spreadsheet. Interested?', 'pending')
  ON CONFLICT (project_id, recipient_id) DO NOTHING;

  -- ── Chat history ───────────────────────────────────────────────────────
  INSERT INTO public.chat_messages (project_id, sender_id, content, created_at) VALUES
    (p_field, goutam, 'Pushed the offline queue. Sync survives a full signal drop now.', now() - interval '2 days'),
    (p_field, demo,   'Nice. Did you handle two notes editing the same record?',         now() - interval '2 days' + interval '12 minutes'),
    (p_field, goutam, 'Last-write-wins for now. Flagged it in the README.',              now() - interval '2 days' + interval '25 minutes'),
    (p_field, johnu,  'I can take the merge UI this week if that helps.',                now() - interval '1 day'),
    (p_field, demo,   'That would be great. Grab the Figma frame called Conflict.',      now() - interval '20 hours'),

    (p_lumen, john,   'First pass at the check-in screen is in Figma.',                  now() - interval '5 hours'),
    (p_lumen, demo,   'Looks good. Can we drop the streak counter? Feels punitive for a wellbeing app.', now() - interval '4 hours 30 minutes'),
    (p_lumen, john,   'Fair. Removing it.',                                              now() - interval '4 hours'),

    (p_pulp,  john,   'Storyboard is done, moving on to the shot list.',                 now() - interval '1 day 6 hours'),
    (p_pulp,  demo,   'I will take the title cards.',                                    now() - interval '1 day 4 hours')
  ON CONFLICT DO NOTHING;

  -- ── Timeline hygiene ───────────────────────────────────────────────────
  -- Every member insert above fired on_member_join with created_at = now(),
  -- which would dump the entire seed into the 48-hour Pulse window at once.
  -- Push them all back, then re-surface a deliberate handful.
  UPDATE public.collaboration_events e
     SET created_at = p.updated_at - interval '10 days'
    FROM public.projects p
   WHERE p.id = e.project_id
     AND ('seed:demo-preview' = ANY(p.tags) OR 'seed:archive-preview' = ANY(p.tags))
     AND e.created_at > now() - interval '1 hour';

  INSERT INTO public.collaboration_events (project_id, user_id, event_type, metadata, created_at) VALUES
    (p_lumen, john,   'join',       '{"role":"Designer"}'::jsonb,    now() - interval '5 hours'),
    (p_field, johnu,  'join',       '{"role":"Backend Dev"}'::jsonb, now() - interval '19 hours'),
    (p_pulp,  demo,   'mou_signed', '{}'::jsonb,                     now() - interval '26 hours'),
    (p_field, goutam, 'mou_signed', '{}'::jsonb,                     now() - interval '40 hours');
END $$;
