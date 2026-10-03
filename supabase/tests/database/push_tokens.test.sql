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
reset role;
select hasnt_column('public', 'profiles', 'expo_push_token', 'the token is gone from profiles');
select * from finish();
rollback;
