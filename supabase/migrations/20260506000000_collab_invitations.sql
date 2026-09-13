-- ── collab_invitations ──────────────────────────────────────────────────────────
-- Project owners can invite talent to join a project with a role + message.
-- Status flows: pending → accepted | declined (terminal states).

CREATE TABLE collab_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
  UNIQUE (project_id, recipient_id)
);

ALTER TABLE collab_invitations ENABLE ROW LEVEL SECURITY;

-- Sender: read + insert their own rows (insert gated on project ownership)
CREATE POLICY "invitations: sender select"
  ON collab_invitations FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "invitations: sender insert"
  ON collab_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Recipient: read + update (accept / decline) their own incoming rows
CREATE POLICY "invitations: recipient select"
  ON collab_invitations FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "invitations: recipient update"
  ON collab_invitations FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (status IN ('accepted', 'declined'));
