-- ============================================================
-- Leaving goes through one RPC; a commitment counts once approved.
-- ============================================================
--
-- 20261003100500 let a member self-log member_quit if they were ever in the
-- project, because the app deleted the membership row before logging. That
-- let a former member log member_quit again and again, and the app's
-- member_left chat message was refused (chat send needs an approved member
-- row, which was already gone). leave_project now does all three in one
-- transaction, so only the owner writes events directly.

alter policy "events: self or owner insert" on public.collaboration_events
  with check (
    exists (select 1 from public.projects p
            where p.id = collaboration_events.project_id and p.owner_id = auth.uid())
  );

-- After the policy stops calling it; no cascade, so nothing else is dropped.
drop function public.is_or_was_project_member(uuid);

-- The chat message has the shape the app inserted before
-- (settings/index.tsx, projects/[id]/preview.tsx, HandshakeChat.tsx).
-- A pending joiner never had chat access, so withdrawing posts nothing there.
create or replace function public.leave_project(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_name text;
begin
  select pm.status into v_status from public.project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and not exists (select 1 from public.projects p
                      where p.id = p_project and p.owner_id = auth.uid())
    for update;
  if not found then
    raise exception 'not a member of this project' using errcode = '42501';
  end if;

  delete from public.project_members where project_id = p_project and user_id = auth.uid();

  insert into public.collaboration_events (project_id, user_id, event_type)
  values (p_project, auth.uid(), 'member_quit');

  if v_status = 'approved' then
    select nullif(full_name, '') into v_name from public.profiles where id = auth.uid();
    insert into public.chat_messages (project_id, sender_id, type, content, metadata, read_by)
    values (p_project, auth.uid(), 'member_left', '',
            jsonb_build_object('userName', coalesce(v_name, 'A user')), '{}');
  end if;
end $$;

revoke execute on function public.leave_project(uuid) from public, anon;
grant execute on function public.leave_project(uuid) to authenticated;

-- A commitment is recorded the first time a row is both committed and
-- approved, in either order: commit then approval, approval then commit,
-- or both at once (accept_invitation). Never for the owner's own row.
create or replace function public.record_member_committed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mou_accepted and new.status = 'approved'
     and (tg_op = 'INSERT' or not (coalesce(old.mou_accepted, false) and old.status = 'approved'))
     and not exists (select 1 from public.projects p
                     where p.id = new.project_id and p.owner_id = new.user_id) then
    insert into public.collaboration_events (project_id, user_id, event_type)
    values (new.project_id, new.user_id, 'committed');
  end if;
  return new;
end $$;

drop trigger if exists trg_member_committed on public.project_members;
create trigger trg_member_committed
  after insert or update of mou_accepted, status on public.project_members
  for each row execute function public.record_member_committed();
