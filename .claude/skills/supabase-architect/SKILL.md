---
name: supabase-architect
description: Use when writing SQL migrations, RLS policies, or Edge Functions.
---
# Supabase Architect Skill
## Guardrails
- **RLS is Mandatory:** Never create a table without an accompanying `ALTER TABLE ENABLE ROW LEVEL SECURITY`.
- **Belfast Lock:** All auth hooks must strictly validate `@qub.ac.uk` and `@ulster.ac.uk`.
- **Types:** Always run `supabase gen types` after schema changes.
## Commands
- To apply migrations: `supabase db push`.
- To deploy functions: `supabase functions deploy [name]`.