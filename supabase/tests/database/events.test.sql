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

select plan(44);

-- As postgres: ...e5 an approved member who leaves, ...e6 a pending joiner
-- who withdraws.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e5', 'leaver@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000e6', 'withdrawer@ulster.ac.uk');
update public.profiles set full_name = 'Eve Leaver' where id = '00000000-0000-0000-0000-0000000000e5';
-- The owner's own committed row (as CreateProject inserts it), an approved
-- member who has not committed yet, and pending joiners.
insert into public.project_members (project_id, user_id, role, status, mou_accepted) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Owner', 'approved', true),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved', false),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'pending', false),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e5', 'Writer', 'approved', false),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e6', 'Tester', 'pending', false);

-- ── Only the owner writes events directly ──────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'milestone') $$,
  '42501', null, 'a member cannot log a milestone for themselves');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'committed') $$,
  '42501', null, 'a member cannot log a commitment directly');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'member_quit') $$,
  '42501', null, 'a member cannot log leaving directly: it goes through leave_project');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'member_quit') $$,
  '42501', null, 'an outsider cannot log events on a project they were never in');

-- ── Leaving goes through leave_project ─────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000e5');
select lives_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  'a member can leave through leave_project');
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000e5'), 0,
  'leaving removes the membership row');
select is((select count(*)::int from public.collaboration_events
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000e5'
    and event_type = 'member_quit'), 1,
  'leaving logs exactly one member_quit');
select results_eq(
  $$ select type, content, metadata from public.chat_messages
     where project_id = '00000000-0000-0000-0000-0000000000f1' and sender_id = '00000000-0000-0000-0000-0000000000e5' $$,
  $$ values ('member_left'::text, ''::text, '{"userName": "Eve Leaver"}'::jsonb) $$,
  'leaving posts the member_left message to the chat, as the app did');

select tests.act_as('00000000-0000-0000-0000-0000000000e5');
select throws_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'leaving twice is refused');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e5', 'member_quit') $$,
  '42501', null, 'a former member cannot log member_quit directly');
reset role;
select is((select count(*)::int from public.collaboration_events
  where user_id = '00000000-0000-0000-0000-0000000000e5' and event_type = 'member_quit'), 1,
  'a refused second leave logs nothing');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'the owner cannot leave their own project');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'an outsider cannot leave a project they are not in');
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'the owner''s row survives a refused leave');

-- A pending joiner withdrawing never had chat access: no chat message.
select tests.act_as('00000000-0000-0000-0000-0000000000e6');
select lives_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  'a pending joiner can withdraw through leave_project');
reset role;
select is((select count(*)::int from public.chat_messages
  where sender_id = '00000000-0000-0000-0000-0000000000e6'), 0,
  'a pending joiner withdrawing posts nothing to the chat');

-- ── A commitment counts once the member is approved ────────────────────
-- Commit, then approval.
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
update public.project_members set mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000c3';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000c3'), 0,
  'a pending member who commits records nothing');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.approve_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3');
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000c3'), 1,
  'approving a committed member records exactly one commitment');

-- Approval, then commit.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.project_members set mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'an approved member who commits records one commitment');

-- Later updates record nothing new.
update public.project_members set mou_accepted = true, role = 'Lead designer'
  where user_id = '00000000-0000-0000-0000-0000000000b2';
update public.project_members set status = 'approved', mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000c3';
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'a second update records no second commitment');
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000c3'), 1,
  'a second update after approval records no second commitment');

select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'the owner''s own membership row records no commitment');

-- Both at once: accepting an invitation inserts an approved, committed row.
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

-- ── Once per person per project, ever ──────────────────────────────────
-- Uncommitting and recommitting records nothing new.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.project_members set mou_accepted = false where user_id = '00000000-0000-0000-0000-0000000000b2';
update public.project_members set mou_accepted = true  where user_id = '00000000-0000-0000-0000-0000000000b2';
update public.project_members set mou_accepted = false where user_id = '00000000-0000-0000-0000-0000000000b2';
update public.project_members set mou_accepted = true  where user_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'toggling a commitment off and on records no second commitment');

-- Approve, commit, uncommit, recommit.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e7', 'toggler@qub.ac.uk');
insert into public.project_members (project_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e7', 'Dev');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.approve_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e7');
select tests.act_as('00000000-0000-0000-0000-0000000000e7');
update public.project_members set mou_accepted = true  where user_id = '00000000-0000-0000-0000-0000000000e7';
update public.project_members set mou_accepted = false where user_id = '00000000-0000-0000-0000-0000000000e7';
update public.project_members set mou_accepted = true  where user_id = '00000000-0000-0000-0000-0000000000e7';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000e7'), 1,
  'approve, commit, uncommit, recommit records exactly one commitment');

-- The owner flipping status back and forth records nothing new.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update public.project_members set status = 'pending'  where user_id = '00000000-0000-0000-0000-0000000000e7';
update public.project_members set status = 'approved' where user_id = '00000000-0000-0000-0000-0000000000e7';
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'committed' and user_id = '00000000-0000-0000-0000-0000000000e7'), 1,
  'the owner re-approving a committed member records no second commitment');

-- ── The owner logs removals only ───────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'committed') $$,
  '42501', null, 'the owner cannot forge a commitment');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'join') $$,
  '42501', null, 'the owner cannot forge a join');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'member_quit') $$,
  '42501', null, 'the owner cannot forge a departure');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'milestone') $$,
  '42501', null, 'the owner cannot log a milestone directly');

-- ── Members leave only through leave_project ───────────────────────────
-- b2 stays the actor and stays in the row: the delete policy does the refusing.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'a member''s direct delete of their own row removes nothing');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  'leave_project still works for them');
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000b2'), 0,
  'and removes the row');

-- A whitespace-only name falls back to "A user" in the chat message.
update public.profiles set full_name = '   ' where id = '00000000-0000-0000-0000-0000000000e7';
select tests.act_as('00000000-0000-0000-0000-0000000000e7');
select public.leave_project('00000000-0000-0000-0000-0000000000f1');
reset role;
select is((select metadata->>'userName' from public.chat_messages
  where sender_id = '00000000-0000-0000-0000-0000000000e7' and type = 'member_left'), 'A user',
  'a blank name reads as "A user"');

-- ── Removal goes through remove_member ─────────────────────────────────
-- No client role inserts events directly, the owner included.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into public.collaboration_events (project_id, user_id, event_type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'member_removed') $$,
  '42501', null, 'the owner''s direct member_removed insert is refused');

-- a1 stays the actor and owns the project: no delete policy is what refuses.
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000d4';
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000d4'), 1,
  'the owner''s direct delete of a membership removes nothing');

update public.profiles set full_name = 'Dan Invitee' where id = '00000000-0000-0000-0000-0000000000d4';
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4') $$,
  'the owner can remove a member through remove_member');
reset role;
select is((select count(*)::int from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000d4'), 0,
  'removing deletes the membership row');
select is((select count(*)::int from public.collaboration_events
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000d4'
    and event_type = 'member_removed'), 1,
  'removing logs exactly one member_removed against the member removed');
select results_eq(
  $$ select sender_id, type, content, metadata from public.chat_messages
     where project_id = '00000000-0000-0000-0000-0000000000f1' and type = 'member_removed' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'member_removed'::text, ''::text,
             '{"userName": "Dan Invitee"}'::jsonb) $$,
  'removing posts the member_removed message to the chat, as the app did');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4') $$,
  'P0002', null, 'removing someone twice raises P0002');
-- The owner's own row is not a removable membership: P0002, as if absent.
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0002', null, 'the owner cannot remove their own row');
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'a non-owner cannot remove anyone');

-- A pending joiner never had chat access: removing them posts nothing there.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e8', 'declined@qub.ac.uk');
insert into public.project_members (project_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e8', 'Dev');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e8');
reset role;
select is((select count(*)::int from public.chat_messages where type = 'member_removed'), 1,
  'removing a pending joiner posts nothing to the chat');

select * from finish();
rollback;
