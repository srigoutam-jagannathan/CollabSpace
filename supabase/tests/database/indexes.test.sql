-- Foreign-key indexes behind chat, membership and inbox reads.
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

select plan(7);
select has_index('public', 'chat_messages', 'idx_chat_messages_project_created', 'chat by project');
select has_index('public', 'project_members', 'idx_project_members_user', 'memberships by user');
select has_index('public', 'collaboration_events', 'idx_events_project_type', 'events by project and type');
select has_index('public', 'direct_messages', 'idx_dm_connection_created', 'DMs by connection');
select has_index('public', 'projects', 'idx_projects_owner', 'projects by owner');
select has_index('public', 'collab_invitations', 'idx_invitations_recipient', 'invitations by recipient');
select has_index('public', 'connections', 'idx_connections_recipient', 'connections by recipient');
select * from finish();
rollback;
