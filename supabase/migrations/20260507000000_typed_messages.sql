-- Add type + metadata to both message tables so we can send structured cards (e.g. profile_card)

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB;
