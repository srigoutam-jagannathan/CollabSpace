-- ============================================================
-- SEED — Archive preview data.  NOT schema.  Safe to delete.
-- ============================================================
--
-- Six completed projects so the Shipped rail clears its five-project gate and
-- the Archive deck has something to page through. Added because the archive
-- is otherwise empty until real student work finishes (~May 2027), and the
-- design needed eyeballing before then.
--
-- This lives in migrations only because the Supabase CLI has no command to
-- run one-off SQL against a remote database: `db push` is the only path in.
-- The consequence is that it replays on a fresh environment, which is why
-- every statement is idempotent.
--
-- TEARDOWN — removes every trace, including the cascade to members/events:
--
--   delete from public.projects where 'seed:archive-preview' = any(tags);
--
-- Fixed UUIDs, not uuid_generate_v4(), for two reasons: the teardown stays
-- exact, and generateIdentity() hashes the id — so a re-seed produces the
-- same gradients rather than reshuffling the archive's whole look.
-- ============================================================

insert into public.projects
  (id, created_at, updated_at, owner_id, title, description, status,
   looking_for, tags, university_scope, project_health, github_repo_url, figma_url)
values
  ('a5e1d000-0000-4000-8000-000000000001',
   '2025-10-02 09:00:00+00', '2026-01-28 16:20:00+00',
   '9f47f6c5-1bcc-499c-b52b-cd54e3a70fcc',
   'Tidewater',
   'Fifty years of Antrim coastal erosion, mapped and animated from Ordnance Survey scans. Now cited in two Geography dissertations.',
   'completed', '{}', '{Mapping,"Data Viz","seed:archive-preview"}', 'both', 92.0,
   'https://github.com/example/tidewater', 'https://figma.com/file/example-tidewater'),

  ('a5e1d000-0000-4000-8000-000000000002',
   '2025-11-11 09:00:00+00', '2026-02-19 11:05:00+00',
   'fa57d1e4-c3db-4745-b98f-a650299e1ea0',
   'Beacon',
   'Lost-property matching across both campuses. Replaced a shared spreadsheet that had been running since 2019 and cleared a 400-item backlog in a fortnight.',
   'completed', '{}', '{Logistics,Search,"seed:archive-preview"}', 'both', 88.0,
   'https://github.com/example/beacon', null),

  ('a5e1d000-0000-4000-8000-000000000003',
   '2025-09-20 09:00:00+00', '2026-03-14 14:45:00+00',
   'b3abbc81-69b3-4995-a301-c9adb59c3908',
   'Aurora',
   'AR wayfinding across the Lanyon site. Adopted by the Students'' Union for open days, with 1,400 routes walked in the first month.',
   'completed', '{}', '{AR,Unity,"seed:archive-preview"}', 'qub', 95.0,
   'https://github.com/example/aurora', 'https://figma.com/file/example-aurora'),

  ('a5e1d000-0000-4000-8000-000000000004',
   '2026-01-15 09:00:00+00', '2026-05-07 10:30:00+00',
   '259703f6-73ca-47ad-87de-3aacd4df3edb',
   'Kestrel',
   'A searchable archive of drone survey footage for the Built Environment school, replacing 2TB of unlabelled hard drives with tagged, streamable clips.',
   'completed', '{}', '{Drones,Archive,"seed:archive-preview"}', 'ulster', 81.0,
   null, 'https://figma.com/file/example-kestrel'),

  ('a5e1d000-0000-4000-8000-000000000005',
   '2026-02-03 09:00:00+00', '2026-06-21 17:10:00+00',
   '3ad9adc4-b86d-456f-8b7c-6fba0abb4e2a',
   'Harbour',
   'One front door for student services. Twelve separate enquiry forms collapsed into a single triaged inbox, cutting first-response time from six days to under one.',
   'completed', '{}', '{"Service Design",Accessibility,"seed:archive-preview"}', 'both', 90.0,
   'https://github.com/example/harbour', 'https://figma.com/file/example-harbour'),

  ('a5e1d000-0000-4000-8000-000000000006',
   '2026-03-30 09:00:00+00', '2026-08-12 12:00:00+00',
   '4724a09b-ed86-4ef1-a7b8-dd1af64ce85a',
   'Foghorn',
   'A low-bandwidth alerting tool for the marine research station on Rathlin, built to work over a link that drops for hours at a time.',
   'completed', '{}', '{Offline,Networking,"seed:archive-preview"}', 'both', 76.0,
   'https://github.com/example/foghorn', null)
on conflict (id) do nothing;

-- Teams. The on_member_join trigger fires for each of these and writes a
-- 'join' collaboration_event stamped now() — backdated below.
insert into public.project_members (project_id, user_id, role, mou_accepted)
values
  ('a5e1d000-0000-4000-8000-000000000001', '9f47f6c5-1bcc-499c-b52b-cd54e3a70fcc', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000001', 'fa57d1e4-c3db-4745-b98f-a650299e1ea0', 'Data',        true),
  ('a5e1d000-0000-4000-8000-000000000001', '259703f6-73ca-47ad-87de-3aacd4df3edb', 'Designer',    true),

  ('a5e1d000-0000-4000-8000-000000000002', 'fa57d1e4-c3db-4745-b98f-a650299e1ea0', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000002', 'b3abbc81-69b3-4995-a301-c9adb59c3908', 'Backend Dev', true),
  ('a5e1d000-0000-4000-8000-000000000002', '2150739c-0513-4c0b-a034-d63d61db3bc0', 'Marketing',   true),

  ('a5e1d000-0000-4000-8000-000000000003', 'b3abbc81-69b3-4995-a301-c9adb59c3908', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000003', '9f47f6c5-1bcc-499c-b52b-cd54e3a70fcc', 'Unity Dev',   true),
  ('a5e1d000-0000-4000-8000-000000000003', '3ad9adc4-b86d-456f-8b7c-6fba0abb4e2a', 'Designer',    true),
  ('a5e1d000-0000-4000-8000-000000000003', '5afdaab1-e5b4-44de-9fa5-a2ef6739774d', 'Researcher',  true),

  ('a5e1d000-0000-4000-8000-000000000004', '259703f6-73ca-47ad-87de-3aacd4df3edb', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000004', 'bf8bb622-7805-4a11-b026-618ee1680ed0', 'Backend Dev', true),

  ('a5e1d000-0000-4000-8000-000000000005', '3ad9adc4-b86d-456f-8b7c-6fba0abb4e2a', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000005', '14bd3bbf-1c89-405a-9763-e9f13cb7aac1', 'Service Design', true),
  ('a5e1d000-0000-4000-8000-000000000005', '2150739c-0513-4c0b-a034-d63d61db3bc0', 'Accessibility',  true),
  ('a5e1d000-0000-4000-8000-000000000005', 'fa57d1e4-c3db-4745-b98f-a650299e1ea0', 'Backend Dev',    true),

  ('a5e1d000-0000-4000-8000-000000000006', '4724a09b-ed86-4ef1-a7b8-dd1af64ce85a', 'Lead',        true),
  ('a5e1d000-0000-4000-8000-000000000006', '5afdaab1-e5b4-44de-9fa5-a2ef6739774d', 'Networking',  true),
  ('a5e1d000-0000-4000-8000-000000000006', 'bf8bb622-7805-4a11-b026-618ee1680ed0', 'Backend Dev', true)
on conflict (project_id, user_id) do nothing;

-- Backdate the auto-logged join events to a fortnight before each delivery.
-- Without this every seeded join lands inside the Pulse strip's 48-hour
-- window and the live Discover screen fills with "X joined Tidewater".
update public.collaboration_events e
   set created_at = p.updated_at - interval '14 days'
  from public.projects p
 where p.id = e.project_id
   and 'seed:archive-preview' = any(p.tags)
   and e.created_at > p.updated_at;
