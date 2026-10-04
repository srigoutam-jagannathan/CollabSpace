-- ============================================================
-- Phase 1 final review fixes.
-- ============================================================

-- ── 1. Members update their commitment only; owners update nothing ──────
-- "members: project owner update" (baseline) allowed any column: an owner
-- could set mou_accepted on a member (forging a committed event) or set
-- status back to pending and re-approve (one extra mou_signed each time),
-- and "members: own update" let a member rename their role to "Owner".
-- The app's only update is Profile's Commit button
-- ((tabs)/profile.tsx: mou_accepted, mou_accepted_at). intro_message and
-- role are set on insert by the join form. Approval goes through
-- approve_member / accept_invitation, which are SECURITY DEFINER and run
-- as postgres, so column grants don't apply to them. guard_member_status
-- stays as a backstop.
drop policy "members: project owner update" on public.project_members;

revoke update on public.project_members from anon, authenticated;
grant update (mou_accepted, mou_accepted_at) on public.project_members to authenticated;

-- ── 4. The membership RPCs re-check the Belfast lock ────────────────────
-- SECURITY DEFINER runs as postgres, which skips the restrictive "belfast
-- lock" policies, so a legacy non-university account with a valid JWT
-- could still approve, remove, leave or accept. Each now checks first, as
-- request_connection does. Bodies otherwise unchanged from approve_member
-- (20261003100210), accept_invitation (20261003100200), leave_project
-- (20261003100520) and remove_member (20261003100530). create or replace
-- keeps each ACL; the revoke/grant below restate it.
create or replace function public.approve_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_status text;
begin
  if not public.is_university_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
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

create or replace function public.accept_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inv public.collab_invitations;
begin
  if not public.is_university_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into inv from public.collab_invitations
    where id = p_invitation and recipient_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'no such pending invitation' using errcode = '42501'; end if;
  insert into public.project_members (project_id, user_id, role, status, mou_accepted, mou_accepted_at)
  values (inv.project_id, inv.recipient_id, coalesce(nullif(inv.role, ''), 'member'), 'approved', true, now())
  on conflict on constraint project_members_project_id_user_id_key do update set status = 'approved';
  update public.collab_invitations set status = 'accepted' where id = p_invitation;
end $$;

create or replace function public.leave_project(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_name text;
begin
  if not public.is_university_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
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

create or replace function public.remove_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_status text;
  v_name text;
begin
  if not public.is_university_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
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

revoke execute on function public.approve_member(uuid, uuid) from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.leave_project(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.approve_member(uuid, uuid) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.leave_project(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ── 5. Backfill committed events ────────────────────────────────────────
-- trg_member_committed (20261003100500) records a commitment once per
-- person per project, but rows committed and approved before it have no
-- event, so uncommitting and recommitting would count as new. Same rule as
-- the trigger: approved, committed, not the owner's own row, no committed
-- event yet. Dated when they committed, so "Active right now" doesn't count
-- them; metadata marks them as backfilled. committed_backfill.test.sql
-- re-runs this statement from supabase_migrations.schema_migrations.
insert into public.collaboration_events (project_id, user_id, event_type, created_at, metadata)
select m.project_id, m.user_id, 'committed', coalesce(m.mou_accepted_at, m.created_at),
       jsonb_build_object('backfilled', true)
from public.project_members m
where m.status = 'approved' and m.mou_accepted
  and not exists (select 1 from public.projects p
                  where p.id = m.project_id and p.owner_id = m.user_id)
  and not exists (select 1 from public.collaboration_events e
                  where e.project_id = m.project_id and e.user_id = m.user_id
                    and e.event_type = 'committed');
