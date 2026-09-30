-- A project owner removing a member is not the same act as a member quitting,
-- and collaboration_events is the audit log the PVS engine reads. Reusing
-- 'member_quit' would record the wrong story about who decided.
--
-- Guarded the same way as 20260516000000 added 'member_quit': ALTER TYPE ...
-- ADD VALUE has no IF NOT EXISTS on older servers and cannot run twice.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'member_removed'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'collab_event_type_enum')
  ) THEN
    ALTER TYPE collab_event_type_enum ADD VALUE 'member_removed';
  END IF;
END
$$;
