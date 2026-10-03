-- profiles is readable by every signed-in university user, so the push token
-- was readable by all of them. It moves to its own owner-only table.
create table public.push_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "push_tokens: own row" on public.push_tokens
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every public table carries the Belfast Lock (20261002150000).
create policy "belfast lock" on public.push_tokens as restrictive for all to public
  using ((select public.is_university_user())) with check ((select public.is_university_user()));

insert into public.push_tokens (user_id, token)
  select id, expo_push_token from public.profiles where expo_push_token is not null;
alter table public.profiles drop column expo_push_token;
