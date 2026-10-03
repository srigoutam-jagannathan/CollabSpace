-- ============================================================
-- Event integrity: once-only commitments, owner logs removals only,
-- members leave only through leave_project.
-- ============================================================

-- 1. A commitment is recorded once per person per project, ever. Before,
-- uncommitting and recommitting (or the owner flipping status) recorded a
-- new 'committed' event each time.
create or replace function public.record_member_committed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mou_accepted and new.status = 'approved'
     and (tg_op = 'INSERT' or not (coalesce(old.mou_accepted, false) and old.status = 'approved'))
     and not exists (select 1 from public.projects p
                     where p.id = new.project_id and p.owner_id = new.user_id)
     and not exists (select 1 from public.collaboration_events e
                     where e.project_id = new.project_id and e.user_id = new.user_id
                       and e.event_type = 'committed') then
    insert into public.collaboration_events (project_id, user_id, event_type)
    values (new.project_id, new.user_id, 'committed');
  end if;
  return new;
end $$;

-- 2. The owner could insert any event type about anyone on their project,
-- e.g. 'committed' for an outsider. The only direct insert left is the
-- owner logging a removal (HandshakeChat removeMember); every other event
-- comes from triggers and SECURITY DEFINER RPCs.
alter policy "events: self or owner insert" on public.collaboration_events
  rename to "events: owner logs removals";
alter policy "events: owner logs removals" on public.collaboration_events
  with check (
    event_type = 'member_removed'
    and exists (select 1 from public.projects p
                where p.id = collaboration_events.project_id and p.owner_id = auth.uid())
  );

-- 3. A member could delete their own row directly and skip leave_project,
-- so no member_quit was logged. Only the owner deletes rows directly now;
-- leave_project (SECURITY DEFINER) handles members leaving.
alter policy "members: self or owner delete" on public.project_members
  rename to "members: owner removes";
alter policy "members: owner removes" on public.project_members
  using (
    exists (select 1 from public.projects p
            where p.id = project_members.project_id and p.owner_id = auth.uid())
  );

-- 4. A whitespace-only name falls back to "A user". Otherwise unchanged
-- from 20261003100510.
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
    select nullif(btrim(full_name), '') into v_name from public.profiles where id = auth.uid();
    insert into public.chat_messages (project_id, sender_id, type, content, metadata, read_by)
    values (p_project, auth.uid(), 'member_left', '',
            jsonb_build_object('userName', coalesce(v_name, 'A user')), '{}');
  end if;
end $$;
