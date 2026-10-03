-- RLS regression tests: connections, direct messages, collab invitations.
--
-- Run with: npm run test:db  (needs the local stack: supabase db start)

begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

create schema tests;
grant usage on schema tests to authenticated;

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

-- ── Fixtures ────────────────────────────────────────────────────────────
--   ...a1 alice   ...b2 bob   ...c3 carol (outsider)   ...d4 dave
-- connections.requester_id < recipient_id is a CHECK, so pairs are written low-high.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000d4', 'dave@qub.ac.uk');

insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project');

-- A pending alice-carol request, for "no DMs before acceptance".
insert into public.connections (id, requester_id, recipient_id, initiated_by) values
  ('00000000-0000-0000-0000-00000000c0ac', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1');

-- ── Connections ─────────────────────────────────────────────────────────
-- Requests are sent only through request_connection(), which takes the other
-- person and uses auth.uid() as the asker.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select public.request_connection('00000000-0000-0000-0000-0000000000b2') $$,
  'a user can send a connection request');
-- Pin the new row's id so the tests below can name it.
reset role;
update public.connections set id = '00000000-0000-0000-0000-00000000c0ab'
  where requester_id = '00000000-0000-0000-0000-0000000000a1'
    and recipient_id = '00000000-0000-0000-0000-0000000000b2';

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into public.connections (requester_id, recipient_id, initiated_by)
     values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d4',
             '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'an outsider cannot connect two other people');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ insert into public.connections (requester_id, recipient_id, initiated_by)
     values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d4',
             '00000000-0000-0000-0000-0000000000d4') $$,
  '42501', null, 'nobody can send a request in someone else''s name');

-- The RPC has no initiator argument: whoever calls it is the asker.
select lives_ok(
  $$ select public.request_connection('00000000-0000-0000-0000-0000000000d4') $$,
  'bob can ask dave through the RPC');
reset role;
select is(
  (select initiated_by from public.connections
    where requester_id = '00000000-0000-0000-0000-0000000000b2'
      and recipient_id = '00000000-0000-0000-0000-0000000000d4'),
  '00000000-0000-0000-0000-0000000000b2'::uuid,
  'request_connection records the caller as the initiator, so it cannot be spoofed');

-- A well-formed pending request from a party, in their own name: only the
-- missing insert policy can refuse it.
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into public.connections (requester_id, recipient_id, initiated_by)
     values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d4',
             '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'requests cannot be inserted directly, only sent through request_connection');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select is(
  (select count(*)::int from public.connections where id = '00000000-0000-0000-0000-00000000c0ab'),
  0, 'outsiders cannot see a connection');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.connections where id = '00000000-0000-0000-0000-00000000c0ab'),
  1, 'the recipient sees the request');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update public.connections set status = 'accepted' where id = '00000000-0000-0000-0000-00000000c0ab';
reset role;
select is(
  (select status from public.connections where id = '00000000-0000-0000-0000-00000000c0ab'),
  'pending', 'the sender cannot accept their own request');

-- Bob stays a party (so the new row still passes connections_select) but swaps
-- alice for dave: an accepted connection with someone who never agreed.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ update public.connections set requester_id = '00000000-0000-0000-0000-0000000000b2',
                                   recipient_id = '00000000-0000-0000-0000-0000000000d4',
                                   status = 'accepted'
     where id = '00000000-0000-0000-0000-00000000c0ab' $$,
  '42501', null, 'the recipient cannot rewrite who the connection is between');

select throws_ok(
  $$ update public.connections set status = 'pending' where id = '00000000-0000-0000-0000-00000000c0ab' $$,
  '42501', null, 'a request cannot be answered with anything but accepted or rejected');

update public.connections set status = 'accepted' where id = '00000000-0000-0000-0000-00000000c0ab';
reset role;
select is(
  (select status from public.connections where id = '00000000-0000-0000-0000-00000000c0ab'),
  'accepted', 'the recipient can accept');

-- A fresh alice-dave pair: alice initiates and stays a party, so only the
-- status = 'pending' check can refuse this.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into public.connections (requester_id, recipient_id, initiated_by, status)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d4',
             '00000000-0000-0000-0000-0000000000a1', 'accepted') $$,
  '42501', null, 'a connection cannot be created already accepted');

-- ── Direct messages ─────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.direct_messages (connection_id, sender_id, content)
     values ('00000000-0000-0000-0000-00000000c0ab', '00000000-0000-0000-0000-0000000000a1', 'hi bob') $$,
  'a connected user can send a DM');

select throws_ok(
  $$ insert into public.direct_messages (connection_id, sender_id, content)
     values ('00000000-0000-0000-0000-00000000c0ab', '00000000-0000-0000-0000-0000000000b2', 'spoofed') $$,
  '42501', null, 'a DM cannot be sent as the other person');

select throws_ok(
  $$ insert into public.direct_messages (connection_id, sender_id, content)
     values ('00000000-0000-0000-0000-00000000c0ac', '00000000-0000-0000-0000-0000000000a1', 'too soon') $$,
  '42501', null, 'no DMs until the request is accepted');

-- Defence in depth: connections_select already hides c0ab from carol, so
-- these two pass even without dm_insert/dm_select's party checks. They pin
-- the combined effect, not dm_insert/dm_select on their own.
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into public.direct_messages (connection_id, sender_id, content)
     values ('00000000-0000-0000-0000-00000000c0ab', '00000000-0000-0000-0000-0000000000c3', 'let me in') $$,
  '42501', null, 'an outsider cannot post into a conversation');

select is(
  (select count(*)::int from public.direct_messages where connection_id = '00000000-0000-0000-0000-00000000c0ab'),
  0, 'an outsider cannot read a conversation');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.direct_messages where connection_id = '00000000-0000-0000-0000-00000000c0ab'),
  1, 'the other party reads it');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update public.direct_messages set content = 'edited' where connection_id = '00000000-0000-0000-0000-00000000c0ab';
delete from public.direct_messages where connection_id = '00000000-0000-0000-0000-00000000c0ab';
reset role;
select is(
  (select count(*)::int from public.direct_messages
    where connection_id = '00000000-0000-0000-0000-00000000c0ab' and content = 'hi bob'),
  1, 'DMs are append-only, even for their sender');

-- ── Collab invitations ──────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.collab_invitations (id, project_id, sender_id, recipient_id, role)
     values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Designer') $$,
  'the owner can invite someone to their project');

select throws_ok(
  $$ insert into public.collab_invitations (project_id, sender_id, recipient_id)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3',
             '00000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'an invitation cannot be sent in someone else''s name');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into public.collab_invitations (project_id, sender_id, recipient_id)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3',
             '00000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'only the owner can invite to a project');

select is((select count(*)::int from public.collab_invitations), 0,
  'outsiders see no invitations');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.collab_invitations), 1,
  'the sender sees the invitation');

update public.collab_invitations set status = 'accepted' where id = '00000000-0000-0000-0000-00000000a001';
reset role;
select is(
  (select status from public.collab_invitations where id = '00000000-0000-0000-0000-00000000a001'),
  'pending', 'the sender cannot answer their own invitation');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.collab_invitations), 1,
  'the invitee sees the invitation');

select throws_ok(
  $$ update public.collab_invitations set role = 'Owner', status = 'accepted' where id = '00000000-0000-0000-0000-00000000a001' $$,
  '42501', null, 'the invitee can change only the status');

select throws_ok(
  $$ update public.collab_invitations set status = 'pending' where id = '00000000-0000-0000-0000-00000000a001' $$,
  '42501', null, 'an invitation cannot be answered with anything but accepted or declined');

update public.collab_invitations set status = 'accepted' where id = '00000000-0000-0000-0000-00000000a001';
reset role;
select is(
  (select status from public.collab_invitations where id = '00000000-0000-0000-0000-00000000a001'),
  'accepted', 'the invitee can accept');

-- A fresh invitee (dave) on alice's own project: alice is the sender and the
-- owner, so only the status = 'pending' check can refuse this.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into public.collab_invitations (project_id, sender_id, recipient_id, status)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1',
             '00000000-0000-0000-0000-0000000000d4', 'accepted') $$,
  '42501', null, 'an invitation cannot be created already accepted');

select * from finish();
rollback;
