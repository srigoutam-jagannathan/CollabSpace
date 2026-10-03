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

select plan(13);
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update public.profiles set pvs_score = 999, badges = '{Hacker}', university = 'ulster',
  deleted_at = now(), display_name_at_deletion = 'x', bio = 'hello' where id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select pvs_score from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 0, 'pvs_score is not user-writable');
select is((select badges from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), '{}'::text[], 'badges are not user-writable');
select is((select university::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'qub', 'university follows the email, not the request');
select is((select deleted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), null, 'deletion markers are not user-writable');
select is((select display_name_at_deletion from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), null, 'display_name_at_deletion is not user-writable');
select is((select bio from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'hello', 'ordinary fields still save');

-- Server code (service_role) can still award a score.
set local role service_role;
update public.profiles set pvs_score = 40 where id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select pvs_score from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 40, 'service_role can write the score');

-- Even server code can't set a university the email doesn't give.
set local role service_role;
update public.profiles set university = 'ulster' where id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is((select university::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'qub', 'university follows the email for service_role too');

-- The INSERT path (AuthContext upsert when no profile exists yet).
-- Replica mode skips trg_new_user, so this account starts without a profile.
set local session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e5', 'fresh@ulster.ac.uk');
set local session_replication_role = origin;
select tests.act_as('00000000-0000-0000-0000-0000000000e5');
insert into public.profiles (id, full_name, university, pvs_score, badges, deleted_at, display_name_at_deletion)
  values ('00000000-0000-0000-0000-0000000000e5', 'Fresh', 'qub', 999, '{Hacker}', now(), 'x');
reset role;
select is((select (pvs_score, badges)::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
  '(0,{})', 'a new profile starts with no score or badges');
select is((select university::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
  'ulster', 'a new profile takes its university from the email');
select is((select (deleted_at, display_name_at_deletion)::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
  '(,)', 'a new profile starts with no deletion markers');

-- Nobody can look up another user's university through the helper.
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ select public.university_for_user('00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'users cannot look up university_for_user');
select is(public.own_university()::text, 'qub', 'own_university gives the caller their own');
reset role;

select * from finish();
rollback;
