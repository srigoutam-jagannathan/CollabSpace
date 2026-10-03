-- profiles: own update allowed every column, so users could set their own
-- pvs_score, badges, university and deletion markers. University now follows
-- the auth email on every write; the rest change only via server code.

-- SECURITY DEFINER only to read auth.users; the rule itself is university_for_email.
-- Takes any uid, so it's for server code only: callers through the API could
-- otherwise look up any user's university.
create or replace function public.university_for_user(uid uuid)
returns public.university_enum
language sql stable security definer set search_path = '' as $$
  select public.university_for_email(u.email) from auth.users u where u.id = uid
$$;
revoke execute on function public.university_for_user(uuid) from public, anon, authenticated;
grant execute on function public.university_for_user(uuid) to service_role;

-- The caller's own university, and nobody else's. Takes no argument, so it
-- reveals nothing a user couldn't already read from their own profile row.
create or replace function public.own_university()
returns public.university_enum
language sql stable security definer set search_path = '' as $$
  select public.university_for_user(auth.uid())
$$;
revoke execute on function public.own_university() from public, anon;
grant execute on function public.own_university() to authenticated, service_role;

-- Not SECURITY DEFINER: current_user must be the caller for the role check.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    new.university := public.university_for_user(new.id);
    return new;
  end if;
  -- API callers can only write their own row (profiles: own insert/update
  -- check auth.uid() = id), so their own university is the row's university.
  -- If new.id is anyone else's, RLS refuses the write anyway.
  new.university := public.own_university();
  if tg_op = 'INSERT' then
    new.pvs_score := 0;
    new.badges := '{}';
    new.deleted_at := null;
    new.display_name_at_deletion := null;
  else
    new.pvs_score := old.pvs_score;
    new.badges := old.badges;
    new.deleted_at := old.deleted_at;
    new.display_name_at_deletion := old.display_name_at_deletion;
  end if;
  return new;
end $$;

create trigger trg_protect_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

update public.profiles set university = public.university_for_user(id);
