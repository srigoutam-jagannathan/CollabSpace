-- Phase 1: Add mou_signed to the collaboration event type enum.
-- This supports the HandshakeChat MOU signing feature.
-- NOTE: PostgreSQL enum additions are irreversible without a full type drop/recreate.

ALTER TYPE collab_event_type_enum ADD VALUE 'mou_signed';
