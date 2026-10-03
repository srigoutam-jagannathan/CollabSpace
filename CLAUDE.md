# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Current state, work in flight, decisions and known traps: @docs/HANDOFF.md

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server (scan QR with Expo Go)
npx expo start --ios # iOS simulator
npm run lint         # expo lint
npm run type-check   # tsc --noEmit
npm test             # Jest (npm run test:ci = with coverage floors, as CI runs it)
npm run test:db      # pgTAP RLS tests against the local stack (supabase db reset first)

# Supabase
supabase start                              # Start local Supabase stack
supabase db push                            # Apply migrations to remote
supabase functions deploy analyze-project   # Deploy Edge Function
supabase gen types typescript --project-id <ref> > src/types/database.ts  # Regenerate DB types
```

Environment: copy `.env.example` → `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Architecture

### Routing (Expo Router v3 file-based)

```
app/
  _layout.tsx          ← Root: mounts <AuthProvider>, nothing else
  index.tsx            ← Auth gate: reads status, redirects to (auth) or (app)
  (auth)/              ← Unauthenticated screens (sign-in, access-restricted)
  (app)/               ← Protected screens behind auth guard in (app)/_layout.tsx
```

The `(app)/_layout.tsx` performs a **second auth check** — it redirects to sign-in if `status !== "authenticated"`, so protected screens never need to guard themselves.

**Route structure inside `(app)/`** (route groups don't change URLs, so `/`, `/search`, `/chat/...` stay the same):
```
app/(app)/
  _layout.tsx            ← auth + skills guards, then <Stack> (initial route "(tabs)")
  (tabs)/
    _layout.tsx          ← <Tabs> with CollabTabBar + unread badge (moved from (app)/_layout)
    index.tsx  search.tsx  fab.tsx  chat.tsx  profile.tsx
  chat/ ([id], dm/[id], insights/[id])
  projects/ settings/ users/[id].tsx notifications.tsx discover/[section].tsx archive/index.tsx
                         ← pushed over the tabs by the root Stack
```

`(app)/_layout.tsx` is a Stack whose initial route is the `(tabs)` group. Tab screens live in `(tabs)/`; everything else is pushed over the tabs, so `router.back()` is correct by construction. Link to a non-tab screen with a plain `router.push`; no origin params are needed. Chat rooms live in `(app)/chat/`, not in `(tabs)`: a route inside `(tabs)` pushed from a screen above the tabs would mount a second tab navigator.

### The Belfast Lock (auth domain validation)

`src/features/auth/AuthContext.tsx` is the single point of truth for authentication. On every session change it calls `validateAndApplySession()`:

1. Extracts the email domain
2. Checks it against `ALLOWED_DOMAINS` in `src/features/auth/constants.ts` (`qub.ac.uk`, `ulster.ac.uk`)
3. If invalid → calls `supabase.auth.signOut()` immediately to revoke the token server-side, sets `status = "access_restricted"`
4. If valid → upserts the `profiles` row and sets `status = "authenticated"`

The lock is also enforced in the database (`supabase/migrations/20261002150000_server_side_belfast_lock.sql`): a trigger on `auth.users` refuses non-university sign-ups and email changes, and restrictive `belfast lock` policies on every public table, and on writes to Storage, require the caller's `auth.users` email to be a university address. The client check gives the friendly error; the database check is the one that holds.

**To add a new university in Phase 5:** add the domain to `ALLOWED_DOMAINS` and `DOMAIN_TO_UNIVERSITY` in `constants.ts`, add a `when` branch to `public.university_for_email()` in a new migration, and add the value to `university_enum`.

### Supabase

- Single client instance: `src/lib/supabaseClient.ts` — always import `supabase` from here, never call `createClient()` in feature code.
- Auth provider configured in Supabase dashboard as **Azure** (Microsoft Entra ID). The `prompt: "select_account"` query param forces account selection to prevent silent sign-in with personal Microsoft accounts.
- DB types are hand-authored in `src/types/database.ts`. After schema changes, regenerate with the `supabase gen types` command above.
- Migration history was baselined on 2026-10-02: `supabase/migrations/*_remote_schema.sql` is the live schema, and the earlier files live in `supabase/migrations_archive/` (never applied). `supabase db reset` rebuilds a local copy; `npm run test:db` runs the RLS tests against it. `supabase db diff --linked` should show only Supabase's own `protect_bucket_control_*` storage triggers, which the baseline leaves out.

### Database schema (key design decisions)

- `profiles.pvs_score` — stored here for fast reads; computed by telemetry Edge Functions in Phase 2, not by the client.
- `project_members.mou_accepted` — the member's commitment to the project (owners get `true` on create). The owner approves a member by writing a `mou_signed` collaboration event with `metadata.approved_for` = that member (see `src/features/notifications/pending.ts`). Committed and approved sharing one field is a known gap, tracked as a P1 item.
- `collaboration_events` — **append-only audit log**. A Postgres trigger (`on_member_join`) auto-inserts a `join` event when a member row is created. This table is the raw data source for the PVS engine.
- Realtime is enabled on `chat_messages` and `collaboration_events` tables.
- All tables use RLS. The service role is required for any admin operations.

### Feature folder structure

```
src/features/
  auth/          ← AuthContext, useAuth hook, domain constants
  discover/      ← DiscoverScreen + sections/, ranking, queries, useDiscoverData
  projects/      ← CreateProject, InviteSheet, ProjectInsights (BYO-AI prompts via analyze-project)
  chat/          ← HandshakeChat (project chat, members, group icon), DirectChat (DMs)
  notifications/ ← pending.ts (the pending-count rule behind the badge)
  archive/       ← shipped-project archive deck
  telemetry/pvs/ ← types.ts + usePVS.ts stub (Phase 2)
```

Shared code lives in `src/components/` (Btn, sheets, CollabTabBar), `src/lib/` (`supabaseClient`, `uploadImage`), `src/utils/` and `src/test/` (Supabase and router mocks, test harness).

Feature code should never import across feature boundaries — route data flows via Expo Router params or Supabase queries.

### Edge Function: `analyze-project`

`supabase/functions/analyze-project/index.ts` accepts `{ project_description, looking_for?, tags? }` and returns three `sub_agent_prompts` (Legal, Tech, Marketing). These are system prompts the user pastes into their personal AI account (BYO-AI model). The function currently generates prompts locally — no external AI API call is made.

### Styling

NativeWind v4 with Tailwind. Custom tokens in `tailwind.config.js`:
- `bg-surface` / `bg-surface-card` / `border-surface-border` — dark theme base
- `text-qub-*` / `text-uu-*` — university brand colours (QUB red, UU teal)
- `bg-primary-*` — CollabSpace blue (`#3b82f6` family)

Use `className` on all RN primitives — NativeWind is configured via `babel-preset-expo` with `jsxImportSource: "nativewind"`.
