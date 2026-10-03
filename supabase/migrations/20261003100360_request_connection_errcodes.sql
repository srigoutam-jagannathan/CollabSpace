-- ============================================================
-- request_connection(): distinct error codes and a target check.
--
-- 1. The client maps errors by code, not wording:
--      CS001  within 7 days of a rejection
--      CS002  a request or connection between the pair already exists
-- 2. The target must be a university account. A legacy non-university
--    account, or an unknown id, is refused with 22023 instead of reaching the
--    profiles foreign key.
--
-- Same body as 20261003100350 otherwise. create or replace keeps the
-- function's ACL; the revoke/grant below restate it so this file stands alone.
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
  if not exists (select 1 from auth.users
                 where id = p_other and public.university_for_email(email) is not null) then
    raise exception 'not a valid recipient' using errcode = '22023';
  end if;
  select * into v from public.connections
    where requester_id = v_low and recipient_id = v_high for update;
  if not found then
    insert into public.connections (requester_id, recipient_id, initiated_by)
      values (v_low, v_high, v_me);
  elsif v.status = 'rejected' and v.updated_at <= now() - interval '7 days' then
    update public.connections set status = 'pending', initiated_by = v_me where id = v.id;
  elsif v.status = 'rejected' then
    raise exception 'you can ask again 7 days after a rejection' using errcode = 'CS001';
  else
    raise exception 'a request between you already exists' using errcode = 'CS002';
  end if;
end $$;
revoke execute on function public.request_connection(uuid) from public, anon;
grant execute on function public.request_connection(uuid) to authenticated;
