-- ============================================================
-- notify-owner sends one push per member_quit event.
-- ============================================================
--
-- notify-owner only checked for a member_quit by the caller in the last
-- 10 minutes, so one leave allowed unlimited pushes for 10 minutes, and a
-- self-join -> leave_project -> notify loop could spam any owner.
-- claim_quit_notification marks the quit as notified and returns whether
-- the caller may push. It refuses when:
--   - there is no unclaimed member_quit by p_user on p_project since p_since;
--   - the owner was already told about p_user leaving p_project since
--     p_since (so a join-leave loop sends at most one push per window).

alter table public.collaboration_events add column notified_at timestamptz;

-- No client writes events after insert (there are no update or delete
-- policies). Revoking the privileges makes that a 42501, not a silent no-op.
revoke update, delete on public.collaboration_events from anon, authenticated;

create or replace function public.claim_quit_notification(
  p_project uuid, p_user uuid, p_since timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialises claims per leaver and project, so the window check and the
  -- claim below can't interleave with another call's.
  perform pg_advisory_xact_lock(hashtextextended(p_project::text || p_user::text, 0));
  if exists (select 1 from public.collaboration_events
             where project_id = p_project and user_id = p_user
               and event_type = 'member_quit' and notified_at >= p_since) then
    return false;
  end if;
  -- notified_at is null is repeated outside the subquery as a second guard
  -- against two claims of the same event.
  update public.collaboration_events set notified_at = now()
  where id = (select id from public.collaboration_events
              where project_id = p_project and user_id = p_user
                and event_type = 'member_quit' and created_at >= p_since
                and notified_at is null
              order by created_at desc limit 1)
    and notified_at is null;
  return found;
end $$;

revoke execute on function public.claim_quit_notification(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_quit_notification(uuid, uuid, timestamptz) to service_role;
