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

select plan(14);

select has_column('public', 'collaboration_events', 'notified_at', 'events have notified_at');

-- b2 left f1 just now (as leave_project logs it).
insert into public.project_members (project_id, user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select public.leave_project('00000000-0000-0000-0000-0000000000f1');

-- ── Clients cannot claim or touch notified_at ───────────────────────────
-- b2 stays the actor and acts on their own member_quit event.
select throws_ok($$ update public.collaboration_events set notified_at = now()
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'a user cannot set notified_at on their own event');
select throws_ok($$ update public.collaboration_events set notified_at = null
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'a user cannot clear notified_at to replay');
select throws_ok($$ delete from public.collaboration_events
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'a user cannot delete events');
select throws_ok($$ select public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes') $$,
  '42501', null, 'a user cannot call claim_quit_notification');
set local role anon;
select throws_ok($$ select public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes') $$,
  '42501', null, 'anon cannot call claim_quit_notification');
reset role;

-- ── One push per quit, as notify-owner (service role) ───────────────────
set local role service_role;
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000d4', now() - interval '10 minutes'), false,
  'no quit, no claim');
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes'), true,
  'the first claim for a quit succeeds');
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes'), false,
  'a second claim for the same quit fails');
reset role;
select ok((select notified_at is not null from public.collaboration_events
  where user_id = '00000000-0000-0000-0000-0000000000b2' and event_type = 'member_quit'),
  'the claim marks the event');

-- Rejoin and leave again straight away: a new quit, but the owner was
-- told about this leaver on this project within the window.
insert into public.project_members (project_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select public.leave_project('00000000-0000-0000-0000-0000000000f1');
set local role service_role;
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes'), false,
  'a join-leave loop sends at most one push per window');
reset role;

-- Once the earlier push is outside the window, the newer quit can notify.
update public.collaboration_events set notified_at = now() - interval '20 minutes',
  created_at = now() - interval '20 minutes'
  where user_id = '00000000-0000-0000-0000-0000000000b2' and notified_at is not null;
set local role service_role;
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes'), true,
  'a later quit, outside the window, notifies once');
reset role;

-- A quit older than the window can't be claimed.
update public.collaboration_events set notified_at = null, created_at = now() - interval '20 minutes'
  where user_id = '00000000-0000-0000-0000-0000000000b2';
set local role service_role;
select is(public.claim_quit_notification('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b2', now() - interval '10 minutes'), false,
  'a quit older than the window cannot be claimed');
reset role;
select ok(has_function_privilege('service_role',
  'public.claim_quit_notification(uuid, uuid, timestamptz)', 'execute'),
  'service_role can execute claim_quit_notification');

select * from finish();
rollback;
