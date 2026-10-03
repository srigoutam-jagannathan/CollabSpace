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

select plan(10);

-- As postgres: the owner's own committed row (as CreateProject inserts it),
-- an approved member who has not committed yet, and a pending joiner.
insert into public.project_members (project_id, user_id, role, status, mou_accepted) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Owner', 'approved', true),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved', false),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'pending', false);

-- ── Self-logging is limited to leaving ─────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'milestone') $$,
  '42501', null, 'a member cannot log a milestone for themselves');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'committed') $$,
  '42501', null, 'a member cannot log a commitment directly');
select lives_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'member_quit') $$,
  'a member can still log leaving');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'member_quit') $$,
  '42501', null, 'an outsider cannot log events on a project they were never in');

-- The app deletes the membership row first, then logs member_quit
-- (settings/index.tsx, projects/[id]/preview.tsx, HandshakeChat.tsx).
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3';
select lives_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'member_quit') $$,
  'someone who has just left can log leaving');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'chat') $$,
  '42501', null, 'someone who has left cannot log anything else');

-- ── Committing records the event, server-side ──────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.project_members set mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'committing records a committed event');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'the owner''s own membership row records no commitment');

-- Committing again (an unrelated update) records nothing new.
update public.project_members set mou_accepted = true, role = 'Lead designer'
  where user_id = '00000000-0000-0000-0000-0000000000b2';
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'an already committed member records no second commitment');

-- Accepting an invitation inserts a committed row, which records the event.
insert into public.collab_invitations (project_id, sender_id, recipient_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000d4', 'Dev');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select public.accept_invitation((select id from public.collab_invitations
  where recipient_id = '00000000-0000-0000-0000-0000000000d4'));
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000d4'), 1,
  'accepting an invitation records a committed event');

select * from finish();
rollback;
