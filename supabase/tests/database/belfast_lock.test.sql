-- The Belfast Lock, enforced by the database rather than the app.
--
-- Before 20261002150000 the domain check lived only in AuthContext.tsx, so
-- anyone holding the anon key could sign up with any address and read or
-- write through the API directly.
--
-- Run with: npm run test:db  (needs the local stack: supabase db start)

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create schema tests;
grant usage on schema tests to authenticated, anon;

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
grant execute on function tests.act_as(uuid) to authenticated, anon;

-- ── The domain rule (mirrors resolveUniversity in constants.ts) ─────────
select is(public.university_for_email('ana@qub.ac.uk'), 'qub'::public.university_enum,
  'qub.ac.uk is QUB');
select is(public.university_for_email('Ana@ULSTER.AC.UK'), 'ulster'::public.university_enum,
  'domains match case-insensitively');
select is(public.university_for_email('ana@qub.ac.uk.evil.com'), null,
  'a lookalike domain is not a university');
select is(public.university_for_email('ana@x@qub.ac.uk'), null,
  'two @ signs are refused');
select is(public.university_for_email('ana@qub.ac.u' || chr(8490)), null,
  'a non-ASCII lookalike (KELVIN SIGN for k) is refused before lower-casing');
select is(public.university_for_email(null), null,
  'no email is not a university');

-- ── Sign-up and email change ────────────────────────────────────────────
select throws_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'eve@gmail.com') $$,
  '23514', null, 'a non-university sign-up is refused by the database');

select throws_ok(
  $$ insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e2') $$,
  '23514', null, 'an account with no email (anonymous or phone) is refused');

select lives_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'ana@qub.ac.uk') $$,
  'a university sign-up goes through');

select is(
  (select university from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'qub'::public.university_enum,
  'the new profile records the university from the email');

select throws_ok(
  $$ update auth.users set email = 'ana@gmail.com' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'an account cannot move to a non-university address');

-- ── API access needs a university account ───────────────────────────────
insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.projects), 1,
  'a university user reads projects');

-- A valid JWT for an account that is not a university account: one created
-- before this migration, say. Modelled by a uid with no auth.users row.
select tests.act_as('00000000-0000-0000-0000-0000000000d9');
select is((select count(*)::int from public.projects), 0,
  'a non-university account reads no projects');
select is((select count(*)::int from public.profiles), 0,
  'a non-university account reads no profiles');
select throws_ok(
  $$ insert into public.projects (owner_id, title)
     values ('00000000-0000-0000-0000-0000000000d9', 'spam') $$,
  '42501', null, 'a non-university account cannot create projects');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*)::int from public.profiles), 0,
  'the anon key alone reads no profiles');

reset role;
select * from finish();
rollback;
