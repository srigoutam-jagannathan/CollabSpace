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
-- ...a1 owner  ...c3 joiner  ...d4 second joiner  ...e5 invitee
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000c3', 'joiner@ulster.ac.uk'),
  ('00000000-0000-0000-0000-0000000000d4', 'second@qub.ac.uk'),
  ('00000000-0000-0000-0000-0000000000e5', 'invitee@qub.ac.uk');
-- f1 lists its roles in role_requirements; f2 is a legacy project with looking_for;
-- f3 lists none; f4 is created by the owner below.
insert into public.projects (id, owner_id, title, role_requirements, looking_for) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Roles project',
   '[{"role":"Designer","description":""}]', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Legacy project',
   '[]', '{Legal}'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'No roles project',
   '[]', '{}');
-- Malformed role_requirements on projects someone else owns (f5 to f7), and
-- g1, owned by the second joiner, for the cross-project owner case.
insert into public.projects (id, owner_id, title, role_requirements, looking_for) values
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', 'Empty object', '{}'::jsonb, '{}'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000a1', 'Array of strings', '["x"]'::jsonb, '{}'),
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000a1', 'No role key', '[{"description":"x"}]'::jsonb, '{}'),
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000d4', 'Second joiner project', '[]', '{}');

select plan(16);

-- ── Joiners may only pick a role the project lists ──────────────────────
-- Each refusal is an INSERT of the joiner's own row (user_id = auth.uid()),
-- so the "own insert" policy admits it and only the role check can refuse.
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Owner') $$,
  '42501', 'role not offered by this project', 'a joiner cannot make up the role Owner');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3', 'Designer') $$,
  '42501', 'role not offered by this project', 'a project with no roles accepts no named role');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c3', 'Designer') $$,
  '42501', 'role not offered by this project', 'a role from another project is refused');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'designer') $$,
  '42501', 'role not offered by this project', 'the role match is case-sensitive');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000c3', 'x') $$,
  '42501', 'role not offered by this project', 'role_requirements {} offers no role');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000c3', 'x') $$,
  '42501', 'role not offered by this project', 'role_requirements ["x"] offers no role');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000c3', 'x') $$,
  '42501', 'role not offered by this project', 'role_requirements without a role key offers no role');
select lives_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', 'Designer') $$,
  'a joiner can ask for a role the project lists');
select lives_ok($$ insert into public.project_members (project_id, user_id)
  values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3') $$,
  'a joiner who picks no role joins as member');
select lives_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c3', 'Legal') $$,
  'a legacy project''s looking_for roles are allowed');

select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select lives_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d4', 'member') $$,
  'role member is always allowed');

reset role;
select is((select role from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f3' and user_id = '00000000-0000-0000-0000-0000000000c3'),
  'member', 'the omitted role defaults to member');

-- ── The owner's own row is not limited to the list ──────────────────────
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.projects (id, owner_id, title) values
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Owner project');
select lives_ok($$ insert into public.project_members (project_id, user_id, role, status)
  values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Project Lead', 'approved') $$,
  'the owner adds their own row with any role');
select throws_ok($$ insert into public.project_members (project_id, user_id, role)
  values ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000a1', 'Project Lead') $$,
  '42501', 'role not offered by this project', 'owning one project does not exempt a made-up role on another');

-- ── An accepted invitation keeps the role the owner chose ───────────────
insert into public.collab_invitations (id, project_id, sender_id, recipient_id, role)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000f1',
          '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e5', 'Tester');
select tests.act_as('00000000-0000-0000-0000-0000000000e5');
select lives_ok($$ select public.accept_invitation('00000000-0000-0000-0000-00000000a001') $$,
  'accepting an invitation for an unlisted role still works');
reset role;
select is((select role from public.project_members
  where project_id = '00000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-0000000000e5'),
  'Tester', 'the invited role is kept');
select * from finish();
rollback;
