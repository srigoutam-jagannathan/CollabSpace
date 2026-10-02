-- ============================================================
-- Scope storage writes to the paths the app actually uses.
-- ============================================================
--
-- avatars/<user id>.jpg                 the user's own photo (edit-profile.tsx)
-- avatars/project-icons/<project>.jpg   a project's chat icon, owner only
--                                       (HandshakeChat.tsx)
-- project-media/<project>/<file>        project artwork, owner or members
--
-- Both upload sites send x-upsert, so INSERT and UPDATE share the path rule.
-- ============================================================

create or replace function public.can_write_avatar_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select object_name = auth.uid()::text || '.jpg'
      or exists (
        select 1 from public.projects p
        where p.owner_id = auth.uid()
          and object_name = 'project-icons/' || p.id::text || '.jpg'
      );
$$;

create or replace function public.can_write_project_media(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(object_name))[1]
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_write_avatar_path(text) to authenticated;
grant execute on function public.can_write_project_media(text) to authenticated;

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_write_avatar_path(name));

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and public.can_write_avatar_path(name));

drop policy if exists "project-media: authenticated write" on storage.objects;
create policy "project-media: owner or member write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-media' and public.can_write_project_media(name));

drop policy if exists "project-media: authenticated update" on storage.objects;
create policy "project-media: owner or member update"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-media' and public.can_write_project_media(name))
  with check (bucket_id = 'project-media' and public.can_write_project_media(name));
