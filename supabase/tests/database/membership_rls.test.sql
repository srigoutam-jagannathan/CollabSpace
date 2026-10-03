-- RLS regression tests: project chat, membership, and the audit log.
--
-- Every assertion here was an open hole on the live database on 2026-09-30:
-- any signed-in user could read and post in any project's chat, and nobody
-- could leave a project or be removed from one. See
-- supabase/migrations_archive/20260930000000_fix_chat_rls.sql and
-- 20260930000002_member_removal_policies.sql.
--
-- Run with: npm run test:db  (needs the local stack: supabase db start)

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ── Helpers ─────────────────────────────────────────────────────────────
-- Created inside this transaction, so they vanish with the rollback.
create schema tests;
grant usage on schema tests to authenticated;

-- Become a signed-in user: the authenticated role, with auth.uid() = uid.
create function tests.act_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
end
$$;
grant execute on function tests.act_as(uuid) to authenticated;

-- ── Fixtures (as postgres, so RLS does not apply) ──────────────────────
-- handle_new_user creates each profiles row from the auth.users insert.
--   ...a1 owner   ...b2 member   ...c3 second member   ...d4 outsider
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000b2', 'member@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000c3', 'second@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000d4', 'outsider@qub.ac.uk');

insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project');

-- The owner deliberately has no project_members row: owning a project does
-- not require one, and the policies must not assume it.
-- Both are approved members (20261003100200: only approved members reach the chat).
insert into public.project_members (project_id, user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer', 'approved'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Marketing', 'approved');

insert into public.chat_messages (project_id, sender_id, content) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'members only');

-- ── Reading the chat ────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select is(
  (select count(*)::int from public.chat_messages where project_id = '00000000-0000-0000-0000-0000000000f1'),
  0, 'a non-member cannot read a project''s chat');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.chat_messages where project_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'a member can read the chat');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from public.chat_messages where project_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'the owner can read the chat without a membership row');

-- ── Posting ─────────────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok(
  $$ insert into public.chat_messages (project_id, sender_id, content)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'let me in') $$,
  '42501', null, 'a non-member cannot post in a project''s chat');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$ insert into public.chat_messages (project_id, sender_id, content)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'hello') $$,
  'a member can post');

select throws_ok(
  $$ insert into public.chat_messages (project_id, sender_id, content)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'spoofed') $$,
  '42501', null, 'a member cannot post as somebody else');

-- ── Messages are append-only ────────────────────────────────────────────
-- Still acting as the member. With no UPDATE or DELETE policy these affect
-- zero rows rather than erroring, so check the row afterwards.
update public.chat_messages set content = 'edited'
  where project_id = '00000000-0000-0000-0000-0000000000f1';
delete from public.chat_messages
  where project_id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select is(
  (select count(*)::int from public.chat_messages
    where project_id = '00000000-0000-0000-0000-0000000000f1' and content = 'members only'),
  1, 'nobody can edit or delete a message, not even its sender');

-- ── Removing members ────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3';
reset role;
select is(
  (select count(*)::int from public.project_members
    where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3'),
  1, 'an outsider cannot remove a member');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3';
reset role;
select is(
  (select count(*)::int from public.project_members
    where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3'),
  1, 'a fellow member cannot remove someone else');

-- remove_member deletes the row and logs member_removed in one transaction.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.remove_member('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3');
reset role;
select is(
  (select count(*)::int from public.project_members
    where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3'),
  0, 'the owner can remove a member');

-- ── The audit log ───────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.collaboration_events
    where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000c3'
      and event_type = 'member_removed'),
  1, 'the removal is logged against the member removed');

select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok(
  $$ insert into public.collaboration_events (project_id, user_id, event_type)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'member_removed') $$,
  '42501', null, 'an outsider cannot write events about other people');

-- ── Leaving ─────────────────────────────────────────────────────────────
-- leave_project deletes the row and logs member_quit in one transaction.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$ select public.leave_project('00000000-0000-0000-0000-0000000000f1') $$,
  'a member can leave and log their own departure');
reset role;
select is(
  (select count(*)::int from public.project_members
    where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000b2'),
  0, 'a member can leave');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.chat_messages where project_id = '00000000-0000-0000-0000-0000000000f1'),
  0, 'after leaving, the chat is no longer readable');

select throws_ok(
  $$ insert into public.chat_messages (project_id, sender_id, content)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'still here?') $$,
  '42501', null, 'after leaving, posting is refused');

-- ── Projects stay discoverable ──────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select is(
  (select count(*)::int from public.projects where id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'projects remain readable to everyone signed in (Discover depends on it)');

reset role;
select * from finish();
rollback;
