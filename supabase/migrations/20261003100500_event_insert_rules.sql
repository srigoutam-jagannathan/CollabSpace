-- ============================================================
-- The audit log can't be forged, and commitments are recorded.
-- ============================================================
--
-- Members could log any event type about themselves, including ones that
-- feed reputation. Self-logging is now limited to leaving; everything else
-- comes from the project owner or from server-side triggers and RPCs.
--
-- The app deletes the membership row first and logs member_quit after
-- (settings/index.tsx, projects/[id]/preview.tsx, HandshakeChat.tsx), so a
-- current row isn't required: a join event shows the caller was in the
-- project. join is written only by on_member_join (or the owner).
-- SECURITY DEFINER: a policy on collaboration_events can't query its own
-- table without recursing into its policies.
create or replace function public.is_or_was_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members pm
                 where pm.project_id = p_project and pm.user_id = auth.uid())
      or exists (select 1 from public.collaboration_events j
                 where j.project_id = p_project and j.user_id = auth.uid()
                   and j.event_type = 'join');
$$;
revoke execute on function public.is_or_was_project_member(uuid) from public, anon;
grant execute on function public.is_or_was_project_member(uuid) to authenticated;

alter policy "events: self or owner insert" on public.collaboration_events
  with check (
    exists (select 1 from public.projects p
            where p.id = collaboration_events.project_id and p.owner_id = auth.uid())
    or (
      auth.uid() = user_id
      and event_type = 'member_quit'
      and public.is_or_was_project_member(collaboration_events.project_id)
    )
  );

-- Committing ("Commit" on Profile, or accepting an invitation) records an
-- event. Never for the owner's own row, which is committed on creation.
create or replace function public.record_member_committed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mou_accepted
     and (tg_op = 'INSERT' or not coalesce(old.mou_accepted, false))
     and not exists (select 1 from public.projects p
                     where p.id = new.project_id and p.owner_id = new.user_id) then
    insert into public.collaboration_events (project_id, user_id, event_type)
    values (new.project_id, new.user_id, 'committed');
  end if;
  return new;
end $$;

revoke execute on function public.record_member_committed() from public, anon, authenticated;

create trigger trg_member_committed
  after insert or update of mou_accepted on public.project_members
  for each row execute function public.record_member_committed();
