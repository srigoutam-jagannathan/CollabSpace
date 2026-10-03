-- Reconnect after a rejection, 7 days later (decision 2026-10-03). Requests
-- are sent only through request_connection().
--
-- Run with: supabase test db

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

select plan(6);
-- a1 asked b2; b2 rejected it 8 days ago. c3's rejection by a1 is only 2 days old.
-- update_connections_updated_at is BEFORE UPDATE only, so these back-dated
-- updated_at values survive the insert.
insert into public.connections (requester_id, recipient_id, initiated_by, status, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000a1', 'rejected', now() - interval '8 days'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3',
   '00000000-0000-0000-0000-0000000000c3', 'rejected', now() - interval '2 days');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.request_connection('00000000-0000-0000-0000-0000000000b2') $$,
  'after 7 days the rejected person can ask again');
reset role;
select ok((select status = 'pending' and initiated_by = '00000000-0000-0000-0000-0000000000a1'
  from public.connections where recipient_id = '00000000-0000-0000-0000-0000000000b2'),
  'the old row becomes a fresh pending request from the asker');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.request_connection('00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', null, 'within 7 days of a rejection, nobody can ask again');

select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select lives_ok($$ select public.request_connection('00000000-0000-0000-0000-0000000000b2') $$,
  'a first request between two people works');
reset role;
select is((select count(*)::int from public.connections
  where requester_id = '00000000-0000-0000-0000-0000000000b2' and recipient_id = '00000000-0000-0000-0000-0000000000d4'
    and initiated_by = '00000000-0000-0000-0000-0000000000d4' and status = 'pending'), 1,
  'it is stored low-high with the asker as initiator');

select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ select public.request_connection('00000000-0000-0000-0000-0000000000b2') $$,
  'P0001', null, 'a pending request cannot be sent twice');
select * from finish();
rollback;
