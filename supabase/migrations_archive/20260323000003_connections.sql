-- ── Connections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Canonical: always the lexicographically smaller UUID
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Canonical: always the lexicographically larger UUID
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- The user who actually clicked Connect (may be either canonical position)
  initiated_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (requester_id < recipient_id),
  UNIQUE (requester_id, recipient_id)
);

CREATE OR REPLACE FUNCTION update_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_connections_updated_at();

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Either party can see the connection
CREATE POLICY "connections_select" ON connections FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = recipient_id
);
-- The initiator can insert (they may occupy either canonical position)
CREATE POLICY "connections_insert" ON connections FOR INSERT WITH CHECK (
  auth.uid() = initiated_by AND
  (auth.uid() = requester_id OR auth.uid() = recipient_id)
);
-- The non-initiating party (the one who received the request) can update status
CREATE POLICY "connections_update" ON connections FOR UPDATE USING (
  auth.uid() != initiated_by AND
  (auth.uid() = requester_id OR auth.uid() = recipient_id)
);

-- ── Direct Messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_select" ON direct_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_id
      AND (c.requester_id = auth.uid() OR c.recipient_id = auth.uid())
      AND c.status = 'accepted'
  )
);
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_id
      AND (c.requester_id = auth.uid() OR c.recipient_id = auth.uid())
      AND c.status = 'accepted'
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
