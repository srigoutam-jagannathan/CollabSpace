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

select plan(9);

-- ...d9 a legacy non-university account from before the lock. Replica mode
-- skips the belfast_lock trigger (and trg_new_user, so its profile is
-- inserted by hand). Each refusal below keeps d9 in the row it acts on, so
-- without the lock check the RPC would succeed.
set local session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d9', 'legacy@gmail.com');
insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000d9');
set local session_replication_role = origin;

-- d9 owns f9, where c3 is pending and b2 is approved.
insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000d9', 'Legacy project'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Second project');
insert into public.project_members (project_id, user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'pending'),
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved'),
  -- d9 is an approved member of a1's f1, and invited to a1's f2.
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d9', 'Writer', 'approved');
insert into public.collab_invitations (id, project_id, sender_id, recipient_id, role) values
  ('00000000-0000-0000-0000-00000000a009', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d9', 'Tester');

select tests.act_as('00000000-0000-0000-0000-0000000000d9');
select throws_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f9',
  '00000000-0000-0000-0000-0000000000c3') $$, '42501', null,
  'a legacy owner cannot approve a member');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f9',
  '00000000-0000-0000-0000-0000000000b2') $$, '42501', null,
  'a legacy owner cannot remove a member');
select throws_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'a legacy member cannot leave through the RPC');
select throws_ok($$ select public.accept_invitation('00000000-0000-0000-0000-00000000a009') $$,
  '42501', null, 'a legacy invitee cannot accept an invitation');
reset role;
select is((select status from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f9' and user_id = '00000000-0000-0000-0000-0000000000c3'),
  'pending', 'the refused approval changed nothing');

-- The grants are unchanged: authenticated only.
select ok(not has_function_privilege('anon', 'public.approve_member(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.accept_invitation(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.leave_project(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.remove_member(uuid, uuid)', 'execute'),
  'anon cannot execute the membership RPCs');
select ok(has_function_privilege('authenticated', 'public.approve_member(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.accept_invitation(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.leave_project(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_member(uuid, uuid)', 'execute'),
  'authenticated can execute the membership RPCs');

-- A university owner is unaffected.
insert into public.project_members (project_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'a university owner still approves');
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'a university owner still removes');

select * from finish();
rollback;
