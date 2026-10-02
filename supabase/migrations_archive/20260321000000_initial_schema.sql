-- ============================================================
-- CollabSpace — Phase 0 Initial Schema
-- Run via: supabase db push  OR  paste into Supabase SQL editor
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────
create type university_enum as enum ('qub', 'ulster');
create type project_status_enum as enum ('active', 'completed', 'paused', 'recruiting');
create type collab_event_type_enum as enum ('join', 'chat', 'milestone', 'commit', 'design_sync');

-- ============================================================
-- TABLE: profiles
-- One row per auth.users entry. Created/updated by AuthContext.
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  full_name       text,
  avatar_url      text,

  -- Belfast Lock: only these two universities are valid
  university      university_enum not null,
  department      text,
  year_of_study   smallint check (year_of_study between 1 and 8),
  bio             text,

  -- Skills used for matching and project gap analysis
  skills          text[] not null default '{}',

  -- Project Velocity Score — 0 to 100
  -- Computed by telemetry Edge Functions (Phase 2), stored here for fast reads
  pvs_score       numeric(5,2) not null default 0
                    check (pvs_score between 0 and 100)
);

-- Fast lookup by university
create index profiles_university_idx on public.profiles(university);

-- Row-Level Security
alter table public.profiles enable row level security;

-- Anyone authenticated can read profiles (needed for project member lists)
create policy "profiles: authenticated users can read all"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can only update their own profile
create policy "profiles: users update own row"
  on public.profiles for update
  using (auth.uid() = id);

-- Supabase Auth trigger inserts the row — we allow insert via service role only
create policy "profiles: service role insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- TABLE: projects
-- ============================================================
create table public.projects (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  owner_id            uuid not null references public.profiles(id) on delete cascade,
  title               text not null check (char_length(title) between 3 and 120),
  description         text not null check (char_length(description) >= 20),
  status              project_status_enum not null default 'recruiting',

  -- Roles the project still needs — drives the BYO-AI gap analysis in Phase 1
  looking_for         text[] not null default '{}',
  tags                text[] not null default '{}',

  -- 'both' allows cross-university collaboration
  university_scope    text not null default 'both'
                        check (university_scope in ('qub', 'ulster', 'both')),

  -- Composite health score (0–100) derived from collaboration_events
  -- NULL until first telemetry event is processed
  project_health      numeric(5,2)
                        check (project_health between 0 and 100),

  -- Phase 2: external integrations
  github_repo_url     text,
  figma_url           text
);

create index projects_owner_idx on public.projects(owner_id);
create index projects_status_idx on public.projects(status);
create index projects_tags_idx on public.projects using gin(tags);

alter table public.projects enable row level security;

create policy "projects: authenticated users can read all"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects: owner can insert"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "projects: owner can update"
  on public.projects for update
  using (auth.uid() = owner_id);

create policy "projects: owner can delete"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- TABLE: project_members
-- ============================================================
create table public.project_members (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,

  role            text not null,   -- e.g. "Backend Dev", "Legal Advisor"

  -- Phase 3: MOU acceptance gate
  -- Flipped to true when user signs the auto-generated MOU
  mou_accepted    boolean not null default false,
  mou_accepted_at timestamptz,

  unique (project_id, user_id)
);

create index project_members_project_idx on public.project_members(project_id);
create index project_members_user_idx on public.project_members(user_id);

alter table public.project_members enable row level security;

create policy "project_members: authenticated can read"
  on public.project_members for select
  using (auth.role() = 'authenticated');

create policy "project_members: user can join (insert own row)"
  on public.project_members for insert
  with check (auth.uid() = user_id);

create policy "project_members: user can update own membership"
  on public.project_members for update
  using (auth.uid() = user_id);

create policy "project_members: owner can remove members"
  on public.project_members for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (
      select owner_id from public.projects where id = project_id
    )
  );

-- ============================================================
-- TABLE: collaboration_events
-- Append-only audit log. Every join, message, commit, milestone.
-- This is the raw data source for the PVS engine in Phase 2.
-- ============================================================
create table public.collaboration_events (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,

  event_type      collab_event_type_enum not null,

  -- Flexible JSON payload, schema varies by event_type:
  --   join:        { role: string }
  --   chat:        { message_id: uuid }
  --   milestone:   { title: string, completed: boolean }
  --   commit:      { repo: string, sha: string, message: string }
  --   design_sync: { figma_url: string, frame_count: number }
  metadata        jsonb
);

-- Partitioned-friendly indexes for the Phase 2 analytics queries
create index collab_events_project_idx on public.collaboration_events(project_id);
create index collab_events_user_idx on public.collaboration_events(user_id);
create index collab_events_type_idx on public.collaboration_events(event_type);
create index collab_events_created_idx on public.collaboration_events(created_at desc);

alter table public.collaboration_events enable row level security;

create policy "collab_events: project members can read"
  on public.collaboration_events for select
  using (
    auth.uid() in (
      select user_id from public.project_members where project_id = project_id
    )
    or auth.uid() = (
      select owner_id from public.projects where id = project_id
    )
  );

create policy "collab_events: authenticated users can insert own events"
  on public.collaboration_events for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: chat_messages
-- ============================================================
create table public.chat_messages (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  project_id      uuid not null references public.projects(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,

  content         text not null check (char_length(content) between 1 and 4000),
  read_by         uuid[] not null default '{}'
);

create index chat_messages_project_idx on public.chat_messages(project_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "chat_messages: project members can read"
  on public.chat_messages for select
  using (
    auth.uid() in (
      select user_id from public.project_members where project_id = project_id
    )
  );

create policy "chat_messages: project members can send"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select user_id from public.project_members where project_id = project_id
    )
  );

-- ============================================================
-- FUNCTION: auto-log a 'join' collaboration_event when a member joins
-- ============================================================
create or replace function public.log_join_event()
returns trigger language plpgsql security definer as $$
begin
  insert into public.collaboration_events (project_id, user_id, event_type, metadata)
  values (
    new.project_id,
    new.user_id,
    'join',
    jsonb_build_object('role', new.role)
  );
  return new;
end;
$$;

create trigger on_member_join
  after insert on public.project_members
  for each row execute procedure public.log_join_event();

-- ============================================================
-- FUNCTION: auto-update projects.updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_projects_updated_at
  before update on public.projects
  for each row execute procedure public.touch_updated_at();

create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- Enable Realtime for live chat and project updates
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.collaboration_events;
