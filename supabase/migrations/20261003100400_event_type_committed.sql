-- A member committing to a project. Written only by trg_member_committed
-- (20261003100500). In its own migration: Postgres can't use a new enum
-- value in the transaction that adds it.
alter type public.collab_event_type_enum add value if not exists 'committed';
