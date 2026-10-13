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
-- Joiners may only ask for a role the project lists (20261013090000).
insert into public.projects (id, owner_id, title, role_requirements) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project',
   '[{"role":"Dev","description":""}]');

select plan(21);

-- As postgres: the baseline migration does not create buckets.
insert into storage.buckets (id, name, public) values ('project-media', 'project-media', true)
  on conflict (id) do nothing;
insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Second fixture project');
insert into public.project_members (project_id, user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved');
insert into public.chat_messages (project_id, sender_id, content) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'members only');

-- ── A pending joiner ────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ insert into public.project_members (project_id, user_id, role, status)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'approved') $$,
  'P0001', null, 'a joiner cannot insert themselves approved');
select lives_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev') $$,
  'a joiner can request to join (pending)');
-- c3 stays the actor and stays in the row. Since 20261003100700 the column
-- grant (mou_accepted, mou_accepted_at only) refuses these before the guard.
select throws_ok($$ update public.project_members set status = 'approved'
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'a joiner cannot approve themselves');
select throws_ok($$ update public.project_members set status = 'approved', mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'a joiner cannot approve themselves while committing');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev')
  on conflict (project_id, user_id) do update set status = 'approved' $$,
  '42501', null, 'a joiner cannot approve themselves through an upsert');
-- Still c3's own row in each case; the column grant refuses the move.
select throws_ok($$ update public.project_members set project_id = '00000000-0000-0000-0000-0000000000f2'
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'a membership cannot be moved to another project');
select throws_ok($$ update public.project_members set user_id = '00000000-0000-0000-0000-0000000000d4'
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'a membership cannot be handed to another user');
select lives_ok($$ update public.project_members set mou_accepted = true
  where user_id = '00000000-0000-0000-0000-0000000000c3' $$,
  'committing is still the member''s own call');
select is((select count(*)::int from public.chat_messages
  where project_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'a pending joiner who committed still cannot read the chat');
select throws_ok($$ insert into public.chat_messages (project_id, sender_id, content)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'hi') $$,
  '42501', null, 'a pending joiner cannot post in the chat');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
  values ('project-media', '00000000-0000-0000-0000-0000000000f1/x.jpg', '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'a pending joiner cannot write project media');
select throws_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, '42501', null, 'only the owner can approve');

-- ── The owner approves ──────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'the owner approves');
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'mou_signed' and user_id = '00000000-0000-0000-0000-0000000000a1'
    and metadata->>'approved_for' = '00000000-0000-0000-0000-0000000000c3'), 1,
  'approval writes the owner''s mou_signed event');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'approving an already approved member is a no-op');
reset role;
select is((select count(*)::int from public.collaboration_events
  where event_type = 'mou_signed' and user_id = '00000000-0000-0000-0000-0000000000a1'
    and metadata->>'approved_for' = '00000000-0000-0000-0000-0000000000c3'), 1,
  'approving twice still leaves exactly one mou_signed event');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.approve_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000d4') $$, 'P0002', null, 'approving someone with no membership row fails');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.chat_messages
  where project_id = '00000000-0000-0000-0000-0000000000f1'), 1, 'once approved, the chat opens');

-- ── An accepted invitation counts as approval ───────────────────────────
-- The sender-insert policy requires the sender to own the project, so a1 sends it.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.collab_invitations (id, project_id, sender_id, recipient_id, role)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000f1',
          '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d4', 'Tester');
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.accept_invitation('00000000-0000-0000-0000-00000000a001') $$,
  '42501', null, 'only the invitee can accept');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select lives_ok($$ select public.accept_invitation('00000000-0000-0000-0000-00000000a001') $$,
  'the invitee accepts');
reset role;
select is((select status from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000d4'),
  'approved', 'accepting an invitation makes you an approved member');
select * from finish();
rollback;
