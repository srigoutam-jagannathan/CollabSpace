-- approve_member: approving someone who is already approved is a no-op.
--
-- An invitee (accept_invitation) or a member the 20261003100200 backfill
-- approved can still appear as a request on an older client, and a double
-- tap sends Approve twice. Neither should show an error or log a second
-- mou_signed event. Only a missing membership row raises P0002.

create or replace function public.approve_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_status text;
begin
  select title into v_title from public.projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'not the project owner' using errcode = '42501'; end if;
  select status into v_status from public.project_members
    where project_id = p_project and user_id = p_user for update;
  if not found then raise exception 'no such membership request' using errcode = 'P0002'; end if;
  if v_status = 'approved' then return; end if;
  update public.project_members set status = 'approved'
    where project_id = p_project and user_id = p_user;
  insert into public.collaboration_events (project_id, user_id, event_type, metadata)
  values (p_project, auth.uid(), 'mou_signed',
          jsonb_build_object('approved', true, 'project_title', v_title, 'approved_for', p_user));
end $$;
