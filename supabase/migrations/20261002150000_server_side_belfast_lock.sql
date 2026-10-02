-- ============================================================
-- The Belfast Lock, server-side.
-- ============================================================
--
-- Until now the qub.ac.uk / ulster.ac.uk rule ran only in
-- src/features/auth/AuthContext.tsx. Anyone with the anon key could sign up
-- through the API with any address and use every table the RLS policies
-- left open to "authenticated".
--
-- 1. university_for_email() is the rule, matching resolveUniversity() in
--    src/features/auth/constants.ts. KEEP THE TWO LISTS IN SYNC.
-- 2. A trigger on auth.users refuses non-university sign-ups and email
--    changes, including accounts with no email at all.
-- 3. handle_new_user records the university on the new profile.
-- 4. A restrictive policy on every public table, and on writes to Storage,
--    requires the caller's auth.users email to be a university address. It
--    reads auth.users, not profiles.university, because users can update
--    their own profile row. Storage reads stay open: avatar URLs are public.
-- ============================================================

create or replace function public.university_for_email(email text)
returns public.university_enum
language sql
immutable
set search_path = ''
as $$
  -- ASCII is checked before lower(), as in extractDomain(): lower-casing
  -- folds some non-ASCII letters (U+212A KELVIN SIGN) into ASCII ones.
  select case lower(split_part(email, '@', 2))
           when 'qub.ac.uk' then 'qub'::public.university_enum
           when 'ulster.ac.uk' then 'ulster'::public.university_enum
         end
  where email ~ '^[^@]+@[^@]+$'
    and split_part(email, '@', 2) ~ '^[!-~]+$';
$$;

grant execute on function public.university_for_email(text) to anon, authenticated, service_role;

-- ── 2. Refuse non-university accounts ──────────────────────────────────
create or replace function public.enforce_belfast_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.university_for_email(new.email) is null then
    raise exception 'Only @qub.ac.uk and @ulster.ac.uk email addresses are allowed.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- BEFORE, so it runs ahead of trg_new_user (AFTER INSERT) and no profile
-- row is ever created for a refused address.
create trigger belfast_lock
  before insert or update of email on auth.users
  for each row execute function public.enforce_belfast_lock();

-- ── 3. Profiles record the university ──────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, university)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    public.university_for_email(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 4. API access needs a university account ───────────────────────────
-- security definer: callers cannot read auth.users themselves.
create or replace function public.is_university_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and public.university_for_email(u.email) is not null
  );
$$;

revoke execute on function public.is_university_user() from public;
grant execute on function public.is_university_user() to anon, authenticated, service_role;

-- Restrictive policies are ANDed with the permissive ones already in place.
-- (select ...) lets Postgres evaluate the check once per statement, not per row.
create policy "belfast lock" on public.chat_messages        as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.collab_invitations   as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.collaboration_events as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.connections          as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.direct_messages      as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.profiles             as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.project_members      as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock" on public.projects             as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));

-- Storage: writes only. Public SELECT stays open because avatar URLs are
-- public. Restrictive, so these AND with any path-scoped permissive policies.
create policy "belfast lock: insert" on storage.objects as restrictive for insert to public
  with check ((select public.is_university_user()));
create policy "belfast lock: update" on storage.objects as restrictive for update to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));
create policy "belfast lock: delete" on storage.objects as restrictive for delete to public
  using ((select public.is_university_user()));
