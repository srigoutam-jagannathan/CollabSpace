-- ============================================================
-- Answers are final, and a pair has a single connection row
-- (connections_requester_id_recipient_id_key). To reconnect, 7 days after a
-- rejection either person may turn that row into a fresh pending request
-- (decision 2026-10-03). This RPC is the only way to send one.
--
-- It always inserts pending and always records auth.uid() as the asker, so
-- the pending-only and own-name rules of connections_insert (20261002150200)
-- are folded in here, and that policy is dropped.
--
-- update_connections_updated_at fires on the reopening UPDATE, so updated_at
-- then marks when the fresh request was sent.
-- ============================================================

create or replace function public.request_connection(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_low uuid := least(v_me, p_other);
  v_high uuid := greatest(v_me, p_other);
  v public.connections;
begin
  if v_me is null or p_other is null or v_me = p_other then
    raise exception 'invalid connection request' using errcode = '22023';
  end if;
  if not public.is_university_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v from public.connections
    where requester_id = v_low and recipient_id = v_high for update;
  if not found then
    insert into public.connections (requester_id, recipient_id, initiated_by)
      values (v_low, v_high, v_me);
  elsif v.status = 'rejected' and v.updated_at <= now() - interval '7 days' then
    update public.connections set status = 'pending', initiated_by = v_me where id = v.id;
  elsif v.status = 'rejected' then
    raise exception 'you can ask again 7 days after a rejection';
  else
    raise exception 'a request between you already exists';
  end if;
end $$;
revoke execute on function public.request_connection(uuid) from public, anon;
grant execute on function public.request_connection(uuid) to authenticated;

-- Requests now come only through request_connection().
drop policy "connections_insert" on public.connections;
