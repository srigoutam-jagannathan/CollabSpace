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

insert into public.project_members (project_id, user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Dev', 'approved');

-- ── Members send user messages ──────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
-- HandshakeChat sendMessage: no type, so the 'text' default.
select lives_ok($$ insert into public.chat_messages (project_id, sender_id, content, read_by)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'hi',
          array['00000000-0000-0000-0000-0000000000b2']::uuid[]) $$,
  'a member sends a text message');
select lives_ok($$ insert into public.chat_messages (project_id, sender_id, content, type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'hi', 'text') $$,
  'a member sends an explicit text message');
-- ShareProfileSheet.
select lives_ok($$ insert into public.chat_messages (project_id, sender_id, content, type, metadata)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Shared a profile',
          'profile_card', '{"userId": "00000000-0000-0000-0000-0000000000d4"}') $$,
  'a member shares a profile card');

-- ── Only the server writes system messages ──────────────────────────────
select throws_ok($$ insert into public.chat_messages (project_id, sender_id, content, type, metadata)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', '',
          'member_left', '{"userName": "Someone else"}') $$,
  '42501', null, 'a member cannot post a fake member_left');
select throws_ok($$ insert into public.chat_messages (project_id, sender_id, content, type, metadata)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', '',
          'member_removed', '{"userName": "Someone else"}') $$,
  '42501', null, 'a member cannot post a fake member_removed');
select throws_ok($$ insert into public.chat_messages (project_id, sender_id, content, type, metadata)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', '',
          'account_deleted', '{"userName": "Someone else"}') $$,
  '42501', null, 'a member cannot post a fake account_deleted');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into public.chat_messages (project_id, sender_id, content, type)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '', 'member_removed') $$,
  '42501', null, 'the owner cannot post a fake member_removed either');

-- The RPCs still post theirs.
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000c3') $$, 'remove_member runs');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  'leave_project runs');
reset role;
select is((select array_agg(type order by type) from public.chat_messages
  where type not in ('text', 'profile_card')), array['member_left', 'member_removed'],
  'the RPCs post member_left and member_removed');

select * from finish();
rollback;
