-- ============================================================
-- Removing a member goes through one RPC; no client writes events.
-- ============================================================
--
-- The owner's direct member_removed insert had no check on who was removed:
-- an owner could log any number of removals for anyone, and Active right
-- now counted them. remove_member now deletes the row, logs the event and
-- posts the chat message in one transaction. With leave_project, that
-- makes membership deletion and every event write server-side only:
-- triggers and SECURITY DEFINER RPCs (and the service role in
-- delete-account) are the only writers.

drop policy "events: owner logs removals" on public.collaboration_events;
drop policy "members: owner removes" on public.project_members;

-- Raises 42501 if the caller doesn't own the project, P0002 if p_user has
-- no membership row or is the owner (the owner's own row is not a
-- removable membership). The event and chat message have the shape
-- HandshakeChat's removeMember inserted. A pending joiner never had chat
-- access, so removing one posts nothing there (as in leave_project).
create or replace function public.remove_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_status text;
  v_name text;
begin
  select owner_id into v_owner from public.projects where id = p_project;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not the project owner' using errcode = '42501';
  end if;

  select status into v_status from public.project_members
    where project_id = p_project and user_id = p_user and user_id <> v_owner
    for update;
  if not found then
    raise exception 'no such membership' using errcode = 'P0002';
  end if;

  delete from public.project_members where project_id = p_project and user_id = p_user;

  insert into public.collaboration_events (project_id, user_id, event_type)
  values (p_project, p_user, 'member_removed');

  if v_status = 'approved' then
    select nullif(btrim(full_name), '') into v_name from public.profiles where id = p_user;
    insert into public.chat_messages (project_id, sender_id, type, content, metadata, read_by)
    values (p_project, auth.uid(), 'member_removed', '',
            jsonb_build_object('userName', coalesce(v_name, 'A member')), '{}');
  end if;
end $$;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
