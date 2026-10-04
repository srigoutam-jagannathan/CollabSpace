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

select plan(17);

-- As postgres: the owner's own row, an approved member who has not
-- committed, and a pending joiner.
insert into public.project_members (project_id, user_id, role, status, mou_accepted) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Owner', 'approved', true),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved', false),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'pending', false);

-- ── The owner cannot edit someone else's membership ─────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ update public.project_members set mou_accepted = true, mou_accepted_at = now()
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  'the owner''s commit on a member''s row runs');
reset role;
select is((select mou_accepted from public.project_members
  where user_id = '00000000-0000-0000-0000-0000000000b2'), false,
  '...but changes nothing: only the member commits');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 0,
  'the owner cannot forge a committed event');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ update public.project_members set status = 'pending'
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'the owner cannot set a member back to pending');
select throws_ok($$ update public.project_members set role = 'Intern'
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'the owner cannot rewrite a member''s role');

-- ── A re-approve loop is impossible ─────────────────────────────────────
select lives_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'approve_member still works');
select throws_ok($$ update public.project_members set status = 'pending'
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'the owner cannot un-approve to approve again');
select lives_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'a second approval is a no-op');
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'mou_signed' and metadata->>'approved_for' = '00000000-0000-0000-0000-0000000000c3'), 1,
  'one approval, one mou_signed event');

-- ── A member edits only their commitment ────────────────────────────────
-- b2 stays the actor and stays in the row, so the column grant does the refusing.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ update public.project_members set role = 'Owner'
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'a member cannot rename their role');
select throws_ok($$ update public.project_members set status = 'pending'
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'a member cannot change their status');
select throws_ok($$ update public.project_members set intro_message = 'edited'
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'the intro message is set on joining only');
-- What Profile's Commit button sends.
select lives_ok($$ update public.project_members set mou_accepted = true, mou_accepted_at = now()
  where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  'a member can still commit');
reset role;
select is((select mou_accepted from public.project_members
  where user_id = '00000000-0000-0000-0000-0000000000b2'), true, 'the commitment is saved');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'committing records one committed event');

-- ── Joining is unchanged ────────────────────────────────────────────────
-- What the join form sends.
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select lives_ok($$ insert into public.project_members (project_id, user_id, intro_message, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'hello', 'Dev') $$,
  'a joiner can still request to join with an intro message');

set local role anon;
select throws_ok($$ update public.project_members set mou_accepted = true $$,
  '42501', null, 'anon cannot update memberships');

select * from finish();
rollback;
