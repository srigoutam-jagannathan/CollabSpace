-- Storage write policies: who may write where.
--
-- Before 20261002150100 any signed-in user could upload to any path in
-- avatars and overwrite any project's media in project-media.
--
-- Run with: npm run test:db  (needs the local stack: supabase db start)

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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
-- The baseline migration does not create buckets; the live project has them.
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('project-media', 'project-media', true)
on conflict (id) do nothing;

--   ...a1 owner   ...b2 member   ...c3 outsider
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000b2', 'member@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000c3', 'outsider@qub.ac.uk');

insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Fixture project');
insert into public.project_members (project_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Designer');

-- ── Avatars ─────────────────────────────────────────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('avatars', '00000000-0000-0000-0000-0000000000a1.jpg', '00000000-0000-0000-0000-0000000000a1') $$,
  'a user can upload their own avatar');

select throws_ok(
  $$ update storage.objects set name = 'elsewhere/x.jpg'
     where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000a1.jpg' $$,
  '42501', null, 'an avatar cannot be moved off its owner''s path');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('avatars', '00000000-0000-0000-0000-0000000000b2.jpg', '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'nobody can upload to someone else''s avatar path');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('avatars', 'random/thing.jpg', '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'nothing else can be uploaded to avatars');

-- ── Project chat icons (in the avatars bucket) ──────────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('avatars', 'project-icons/00000000-0000-0000-0000-0000000000f1.jpg', '00000000-0000-0000-0000-0000000000a1') $$,
  'the owner can upload the project''s chat icon');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('avatars', 'project-icons/00000000-0000-0000-0000-0000000000f1.jpg', '00000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'a member cannot replace the chat icon');

-- ── Project media ───────────────────────────────────────────────────────
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('project-media', '00000000-0000-0000-0000-0000000000f1/cover.jpg', '00000000-0000-0000-0000-0000000000b2') $$,
  'a member can upload project media');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('project-media', '00000000-0000-0000-0000-0000000000f1/evil.jpg', '00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'an outsider cannot upload project media');

update storage.objects set metadata = '{"v":"evil"}'
  where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg'),
  null, 'an outsider cannot overwrite project media');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update storage.objects set metadata = '{"v":"2"}'
  where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg'),
  '2', 'the owner can update project media');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update storage.objects set metadata = '{"v":"3"}'
  where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'project-media' and name = '00000000-0000-0000-0000-0000000000f1/cover.jpg'),
  '3', 'a member can update their own project media');

-- ── Updates follow the path, not the stored owner ───────────────────────
-- Both upload sites upsert, so a re-upload is an UPDATE. Objects written
-- by the dashboard, the service role or the old open insert policy can
-- carry a NULL or foreign owner; the rightful path holder must still win.
-- (As postgres, so RLS does not apply.)
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', '00000000-0000-0000-0000-0000000000b2.jpg', null);

insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Second fixture project');
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', 'project-icons/00000000-0000-0000-0000-0000000000f2.jpg', '00000000-0000-0000-0000-0000000000b2');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
update storage.objects set metadata = '{"v":"mine"}'
  where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000b2.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000b2.jpg'),
  'mine', 'a user can update their avatar even when its owner is NULL');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update storage.objects set metadata = '{"v":"icon2"}'
  where bucket_id = 'avatars' and name = 'project-icons/00000000-0000-0000-0000-0000000000f2.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'avatars' and name = 'project-icons/00000000-0000-0000-0000-0000000000f2.jpg'),
  'icon2', 'the project owner can update the chat icon even when another user owns the object');

select tests.act_as('00000000-0000-0000-0000-0000000000c3');
update storage.objects set metadata = '{"v":"evil"}'
  where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000a1.jpg';
reset role;
select is(
  (select metadata->>'v' from storage.objects
    where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000a1.jpg'),
  null, 'an outsider cannot overwrite someone else''s avatar');

select * from finish();
rollback;
