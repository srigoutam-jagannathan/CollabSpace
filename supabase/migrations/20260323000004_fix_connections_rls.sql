-- Fix connections_update policy to enforce status transition direction
DROP POLICY IF EXISTS "connections_update" ON connections;
CREATE POLICY "connections_update" ON connections FOR UPDATE
  USING (
    auth.uid() != initiated_by AND
    (auth.uid() = requester_id OR auth.uid() = recipient_id)
  )
  WITH CHECK (
    status IN ('accepted', 'rejected')
  );

-- Add NOT NULL to created_at and updated_at (project convention)
ALTER TABLE connections ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE connections ALTER COLUMN updated_at SET NOT NULL;
