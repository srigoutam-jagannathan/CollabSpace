-- Allow project owners to update membership rows in their own projects.
-- The existing "members: own update" policy only covers self-updates (user_id = auth.uid()),
-- which blocked owners from setting mou_accepted = true on a joiner's row.
CREATE POLICY "members: project owner update"
  ON project_members FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
