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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@qub.ac.uk');

select plan(4);

select tests.act_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ insert into public.projects (id, owner_id, title, duration, open_to_learners)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1',
             'Aurora', '1_3_months', true) $$,
  'an owner can post a project with a duration bucket and open to learners'
);

select throws_ok(
  $$ insert into public.projects (owner_id, title, duration)
     values ('00000000-0000-0000-0000-0000000000a1', 'Bad', 'forever') $$,
  '23514', null,
  'a duration outside the four buckets is refused'
);

select lives_ok(
  $$ insert into public.projects (id, owner_id, title)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Plain') $$,
  'duration is optional'
);

reset role;
select is(
  (select open_to_learners from public.projects where id = '00000000-0000-0000-0000-0000000000f2'),
  false,
  'projects are not open to learners unless the owner says so'
);

select * from finish();
rollback;
