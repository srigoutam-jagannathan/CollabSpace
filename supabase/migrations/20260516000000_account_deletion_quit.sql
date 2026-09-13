-- Soft-delete support on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS display_name_at_deletion TEXT,
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- New collaboration event type value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'member_quit'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'collab_event_type_enum')
  ) THEN
    ALTER TYPE collab_event_type_enum ADD VALUE 'member_quit';
  END IF;
END
$$;

-- Index for ghost-rendering lookups
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;
