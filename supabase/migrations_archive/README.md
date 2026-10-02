# Archived migrations — never applied again

These are the migrations from 2026-03-21 to 2026-09-30, kept for history.
They could not be replayed on a fresh database: two "initial schema"
migrations created the same objects, and several seed migrations inserted
rows owned by real user ids that only exist on the live project.

On 2026-10-02 they were replaced by a single baseline pulled from the live
schema (`supabase/migrations/*_remote_schema.sql`), and their versions were
marked reverted in the remote history. The live database itself was not
changed. Read these for the reasoning behind a policy; do not move them back.
