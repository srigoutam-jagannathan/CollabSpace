-- ============================================================
-- A joiner can only ask for a role the project offers.
-- ============================================================
--
-- "members: own insert" let a joiner write any role text, so a request
-- could read "Owner". A joiner's own row may now carry only 'member' (the
-- column default) or a role the project names: in role_requirements[].role,
-- or, for older projects, in looking_for.
--
-- A separate INSERT-only trigger rather than a rewrite of
-- guard_member_status: that body stays as reviewed, and members can't
-- UPDATE role (the column grant allows only mou_accepted and
-- mou_accepted_at), so INSERT is the only way in.
--
-- Not SECURITY DEFINER, like guard_member_status: current_user must be the
-- caller. accept_invitation and the other RPCs run as postgres and pass
-- straight through, so an invitation keeps the role the owner chose. The
-- owner's own rows are exempt. projects is readable by every signed-in
-- university user ("projects: public read"), so the caller can read the
-- list.
-- ============================================================

create or replace function public.guard_member_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  if new.role = 'member' then return new; end if;
  if exists (
    select 1 from public.projects p
    where p.id = new.project_id
      and (
        p.owner_id = auth.uid()
        or new.role = any (p.looking_for)
        or (jsonb_typeof(p.role_requirements) = 'array'
            and exists (select 1 from jsonb_array_elements(p.role_requirements) r
                        where jsonb_typeof(r) = 'object' and r->>'role' = new.role))
      )
  ) then
    return new;
  end if;
  raise exception 'role not offered by this project' using errcode = '42501';
end $$;

create trigger trg_guard_member_role
  before insert on public.project_members
  for each row execute function public.guard_member_role();
