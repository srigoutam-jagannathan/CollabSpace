-- Phase 1 UI redesign — additional fields for new form fields and profile sections

-- Projects: new fields from the redesigned Create Project form
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS project_type TEXT,
  ADD COLUMN IF NOT EXISTS collaboration_style TEXT,
  ADD COLUMN IF NOT EXISTS team_size INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS commitment_hours INT DEFAULT 5;

-- Project members: intro message from the Join Project screen
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS intro_message TEXT;

-- Profiles: fields needed for the redesigned Profile screen
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_links JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
