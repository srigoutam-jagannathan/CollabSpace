begin;
create extension if not exists pgtap with schema extensions;
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on function tests.act_as(uuid) to authenticated;
-- ...a1 owner  ...b2 approved member  ...c3 pending joiner  ...d4 outsider
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000b2', 'member@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000c3', 'pending@ulster.ac.uk'),
  ('00000000-0000-0000-0000-0000000000d4', 'outsider@qub.ac.uk');
insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project');

select plan(8);

-- pgTAP runs after every migration, so rows can't be seeded before the
-- backfill. Instead: seed rows as they were before 20261003100500 (replica
-- mode skips trg_member_committed and trg_member_join), then run the
-- backfill statement exactly as the migration recorded it in
-- supabase_migrations.schema_migrations.
set local session_replication_role = replica;
insert into public.project_members (project_id, user_id, role, status, mou_accepted, mou_accepted_at) values
  -- the owner's own row
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Owner', 'approved', true, now()),
  -- approved and committed a month ago, no committed event
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved', true,
   now() - interval '30 days'),
  -- committed but never approved
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'pending', true, now()),
  -- approved and committed, and already has a committed event
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'Tester', 'approved', true, now());
insert into public.collaboration_events (project_id, user_id, event_type) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'committed');
set local session_replication_role = origin;

create temp table backfill as
  select s as stmt from supabase_migrations.schema_migrations m, unnest(m.statements) s
  where m.version = '20261003100700' and s ilike '%insert into public.collaboration_events%backfilled%';
select is((select count(*)::int from backfill), 1, 'the migration has one backfill statement');
do $$ begin execute (select stmt from backfill); end $$;

select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'an approved, committed member gets a committed event');
select ok((select created_at < now() - interval '29 days' from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'),
  'dated when they committed, so it is not counted as recent activity');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'the owner''s own row gets none');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000c3'), 0,
  'a pending member gets none');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000d4'), 1,
  'a member who already has one gets no second');

do $$ begin execute (select stmt from backfill); end $$;
select is((select count(*)::int from public.collaboration_events where event_type = 'committed'), 2,
  'running the backfill again adds nothing');

-- With the event in place, uncommitting and recommitting records nothing new.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.project_members set mou_accepted = false where user_id = '00000000-0000-0000-0000-0000000000b2';
update public.project_members set mou_accepted = true, mou_accepted_at = now()
  where user_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'a backfilled member recommitting is not counted as new');

select * from finish();
rollback;
