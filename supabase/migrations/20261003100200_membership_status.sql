-- ============================================================
-- Membership approval is the owner's alone.
-- ============================================================
--
-- "Committed" (the member's choice) and "approved" (the owner's choice)
-- shared mou_accepted, so a pending joiner who committed was treated as
-- approved, and chat and project-media access only checked that a member
-- row existed. status now records approval; only the project owner (or an
-- accepted invitation) sets it. mou_accepted goes back to meaning
-- "committed" only.
-- ============================================================

alter table public.project_members
  add column status text not null default 'pending'
  check (status in ('pending', 'approved'));

-- Backfill: rows that are committed, the owner's own, or approved by an owner
-- mou_signed event keep access. Pending joiners the owner never approved
-- lose chat and project-media access until the owner approves them.
update public.project_members m set status = 'approved'
where m.mou_accepted
   or exists (select 1 from public.projects p where p.id = m.project_id and p.owner_id = m.user_id)
   or exists (select 1 from public.collaboration_events e
              join public.projects p on p.id = e.project_id
              where e.project_id = m.project_id and e.event_type = 'mou_signed'
                and e.user_id = p.owner_id and e.metadata->>'approved_for' = m.user_id::text);

-- on_member_join (baseline) named collaboration_events unqualified and had no
-- search_path, so it failed when a member row was inserted from a function
-- that sets search_path = '' (accept_invitation below). Same body, pinned.
create or replace function public.on_member_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collaboration_events (project_id, user_id, event_type)
  values (new.project_id, new.user_id, 'join');
  return new;
end $$;

-- Not SECURITY DEFINER: current_user must be the caller for the role check.
-- approve_member and accept_invitation run as postgres and pass straight through.
create or replace function public.guard_member_status() returns trigger
language plpgsql set search_path = '' as $$
declare is_owner boolean;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  select exists (select 1 from public.projects p
                 where p.id = new.project_id and p.owner_id = auth.uid()) into is_owner;
  if tg_op = 'INSERT' and new.status = 'approved' and not is_owner then
    raise exception 'only the project owner can add an approved member';
  end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and not is_owner then
      raise exception 'only the project owner can change membership status';
    end if;
    if new.project_id <> old.project_id or new.user_id <> old.user_id then
      raise exception 'membership cannot be moved';
    end if;
  end if;
  return new;
end $$;

create trigger trg_guard_member_status
  before insert or update on public.project_members
  for each row execute function public.guard_member_status();

create or replace function public.approve_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  select title into v_title from public.projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'not the project owner' using errcode = '42501'; end if;
  update public.project_members set status = 'approved'
    where project_id = p_project and user_id = p_user and status = 'pending';
  if not found then raise exception 'no pending request' using errcode = 'P0002'; end if;
  insert into public.collaboration_events (project_id, user_id, event_type, metadata)
  values (p_project, auth.uid(), 'mou_signed',
          jsonb_build_object('approved', true, 'project_title', v_title, 'approved_for', p_user));
end $$;

-- Accepting is the invitee committing, so mou_accepted is set on a new row.
-- An existing row (e.g. a pending request) is approved but its commitment
-- is left as the member set it.
create or replace function public.accept_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inv public.collab_invitations;
begin
  select * into inv from public.collab_invitations
    where id = p_invitation and recipient_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'no such pending invitation' using errcode = '42501'; end if;
  insert into public.project_members (project_id, user_id, role, status, mou_accepted, mou_accepted_at)
  values (inv.project_id, inv.recipient_id, coalesce(nullif(inv.role, ''), 'member'), 'approved', true, now())
  on conflict on constraint project_members_project_id_user_id_key do update set status = 'approved';
  update public.collab_invitations set status = 'accepted' where id = p_invitation;
end $$;

revoke execute on function public.approve_member(uuid, uuid) from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.approve_member(uuid, uuid) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- Chat is for approved members and the owner.
alter policy "chat_messages: members and owner read" on public.chat_messages
  using (
    exists (select 1 from public.project_members pm
            where pm.project_id = chat_messages.project_id and pm.user_id = auth.uid()
              and pm.status = 'approved')
    or exists (select 1 from public.projects p
               where p.id = chat_messages.project_id and p.owner_id = auth.uid())
  );
alter policy "chat_messages: members and owner send" on public.chat_messages
  with check (
    auth.uid() = sender_id and (
      exists (select 1 from public.project_members pm
              where pm.project_id = chat_messages.project_id and pm.user_id = auth.uid()
                and pm.status = 'approved')
      or exists (select 1 from public.projects p
                 where p.id = chat_messages.project_id and p.owner_id = auth.uid())
    )
  );

-- Project media is for approved members and the owner (was: any member row).
-- Replaces the definition in 20261002150100; its policies call it by name.
create or replace function public.can_write_project_media(object_name text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(object_name))[1]
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = auth.uid() and m.status = 'approved'
        )
      )
  );
$$;
