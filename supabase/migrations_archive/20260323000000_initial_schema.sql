-- ============================================================
-- CollabSpace — Full Initial Schema
-- Run this in Supabase SQL Editor (Project: nrtleybrvlmrnyfyhhps)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ───────────────────────────────────────────────────
CREATE TYPE university_enum AS ENUM ('qub', 'ulster');

CREATE TYPE project_status_enum AS ENUM ('active', 'completed', 'paused', 'recruiting');

CREATE TYPE collab_event_type_enum AS ENUM (
  'join', 'chat', 'milestone', 'commit', 'design_sync', 'mou_signed'
);

-- ── profiles ────────────────────────────────────────────────
-- One row per user, keyed to auth.users.id
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name        TEXT,
  avatar_url       TEXT,
  university       university_enum,
  department       TEXT,
  year_of_study    INT,
  bio              TEXT,
  skills           TEXT[]   NOT NULL DEFAULT '{}',
  badges           TEXT[]   NOT NULL DEFAULT '{}',
  portfolio_links  JSONB    NOT NULL DEFAULT '[]',
  pvs_score        INT      NOT NULL DEFAULT 0
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read any profile (needed for discovery feed)
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles: own update"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (created on first sign-in)
CREATE POLICY "profiles: own insert"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── projects ────────────────────────────────────────────────
CREATE TABLE projects (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  status             project_status_enum NOT NULL DEFAULT 'recruiting',
  looking_for        TEXT[]  NOT NULL DEFAULT '{}',
  tags               TEXT[]  NOT NULL DEFAULT '{}',
  university_scope   TEXT    NOT NULL DEFAULT 'both', -- 'qub' | 'ulster' | 'both'
  project_health     INT,
  github_repo_url    TEXT,
  figma_url          TEXT,
  -- Phase 1 UI fields
  start_date         DATE,
  end_date           DATE,
  project_type       TEXT,
  collaboration_style TEXT,
  team_size          INT  NOT NULL DEFAULT 1,
  commitment_hours   INT  NOT NULL DEFAULT 5
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: public read"
  ON projects FOR SELECT USING (true);

CREATE POLICY "projects: owner insert"
  ON projects FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "projects: owner update"
  ON projects FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "projects: owner delete"
  ON projects FOR DELETE USING (auth.uid() = owner_id);

-- ── project_members ─────────────────────────────────────────
CREATE TABLE project_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'member',
  intro_message    TEXT,
  mou_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
  mou_accepted_at  TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members: public read"
  ON project_members FOR SELECT USING (true);

CREATE POLICY "members: own insert"
  ON project_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members: own update"
  ON project_members FOR UPDATE USING (auth.uid() = user_id);

-- ── collaboration_events ─────────────────────────────────────
-- Append-only audit log — never UPDATE or DELETE rows
CREATE TABLE collaboration_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  collab_event_type_enum NOT NULL,
  metadata    JSONB
);

ALTER TABLE collaboration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events: public read"
  ON collaboration_events FOR SELECT USING (true);

CREATE POLICY "events: authenticated insert"
  ON collaboration_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── chat_messages ────────────────────────────────────────────
CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  read_by     UUID[] NOT NULL DEFAULT '{}'
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat: project members read"
  ON chat_messages FOR SELECT USING (true);

CREATE POLICY "chat: authenticated insert"
  ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ── Realtime ─────────────────────────────────────────────────
-- Enable realtime for live chat and event feed
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_events;

-- ── Auto-join trigger ────────────────────────────────────────
-- When someone joins a project, auto-log a 'join' collaboration event
CREATE OR REPLACE FUNCTION on_member_join()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO collaboration_events (project_id, user_id, event_type)
  VALUES (NEW.project_id, NEW.user_id, 'join');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_member_join
  AFTER INSERT ON project_members
  FOR EACH ROW EXECUTE FUNCTION on_member_join();

-- ── Profile auto-create trigger ──────────────────────────────
-- Creates a minimal profile row the moment a user signs up,
-- so foreign key references never fail.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
