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

select plan(8);
insert into public.push_tokens (user_id, token) values
  ('00000000-0000-0000-0000-0000000000a1', 'ExponentPushToken[owner]');

select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select is((select count(*)::int from public.push_tokens), 0, 'others cannot read your push token');
select throws_ok($$ insert into public.push_tokens (user_id, token)
  values ('00000000-0000-0000-0000-0000000000a1', 'hijack') $$, '42501', null,
  'nobody can register a token for someone else');
select lives_ok($$ insert into public.push_tokens (user_id, token)
  values ('00000000-0000-0000-0000-0000000000d4', 'ExponentPushToken[mine]') $$,
  'you can register your own');
-- d4 stays the actor and a1 stays in the row, so each of these is stopped by
-- the own-row policy, not by the row disappearing.
update public.push_tokens set token = 'x'
  where user_id = '00000000-0000-0000-0000-0000000000a1';
delete from public.push_tokens
  where user_id = '00000000-0000-0000-0000-0000000000a1';
select throws_ok($$ insert into public.push_tokens (user_id, token)
  values ('00000000-0000-0000-0000-0000000000a1', 'hijack')
  on conflict (user_id) do update set token = excluded.token $$, '42501', null,
  'nobody can upsert over someone else''s token');
reset role;
select is((select token from public.push_tokens
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 'ExponentPushToken[owner]',
  'nobody can overwrite someone else''s token');
select is((select count(*)::int from public.push_tokens
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'nobody can delete someone else''s token');
select hasnt_column('public', 'profiles', 'expo_push_token', 'the token is gone from profiles');

-- A legacy account: a gmail.com address created before the Belfast Lock.
-- Replica mode skips the belfast_lock trigger (and trg_new_user, so its
-- profiles row is inserted by hand). The own-row policy would let it read
-- its token; only the lock stops it.
set local session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d9', 'legacy@gmail.com');
set local session_replication_role = origin;
insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000d9');
insert into public.push_tokens (user_id, token) values
  ('00000000-0000-0000-0000-0000000000d9', 'ExponentPushToken[legacy]');
select tests.act_as('00000000-0000-0000-0000-0000000000d9');
select is((select count(*)::int from public.push_tokens), 0,
  'a non-university account cannot read even its own token');
reset role;
select * from finish();
rollback;
