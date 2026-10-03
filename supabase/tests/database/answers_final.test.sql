-- Answers are final (decision 2026-10-02): a connection or invitation can only
-- be answered while it is pending.
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

select plan(4);
insert into public.connections (id, requester_id, recipient_id, initiated_by) values
  ('00000000-0000-0000-0000-00000000c0ab', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
insert into public.collab_invitations (id, project_id, sender_id, recipient_id) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');

-- b2 stays the recipient throughout, so only the pending condition can refuse
-- the second answer.
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.connections set status = 'rejected' where id = '00000000-0000-0000-0000-00000000c0ab';
update public.connections set status = 'accepted' where id = '00000000-0000-0000-0000-00000000c0ab';
update public.collab_invitations set status = 'declined' where id = '00000000-0000-0000-0000-00000000a001';
update public.collab_invitations set status = 'accepted' where id = '00000000-0000-0000-0000-00000000a001';
reset role;
select is((select status from public.connections where id = '00000000-0000-0000-0000-00000000c0ab'),
  'rejected', 'a rejected request cannot be accepted later');
select is((select status from public.collab_invitations where id = '00000000-0000-0000-0000-00000000a001'),
  'declined', 'a declined invitation cannot be accepted later');

-- The first answer still works.
insert into public.connections (id, requester_id, recipient_id, initiated_by) values
  ('00000000-0000-0000-0000-00000000c0ac', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1');
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
update public.connections set status = 'accepted' where id = '00000000-0000-0000-0000-00000000c0ac';
reset role;
select is((select status from public.connections where id = '00000000-0000-0000-0000-00000000c0ac'),
  'accepted', 'a pending request can still be accepted');
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
update public.connections set status = 'rejected' where id = '00000000-0000-0000-0000-00000000c0ac';
reset role;
select is((select status from public.connections where id = '00000000-0000-0000-0000-00000000c0ac'),
  'accepted', 'an accepted connection cannot be flipped to rejected either');
select * from finish();
rollback;
