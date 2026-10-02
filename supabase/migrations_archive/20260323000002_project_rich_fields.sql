-- Add owner_role and role_requirements to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner_role TEXT,
  ADD COLUMN IF NOT EXISTS role_requirements JSONB DEFAULT '[]';
