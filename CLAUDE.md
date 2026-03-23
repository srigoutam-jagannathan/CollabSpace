# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server (scan QR with Expo Go)
npx expo start --ios # iOS simulator
npm run lint         # expo lint
npm run type-check   # tsc --noEmit (no test runner configured yet)

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

**Phase 1 route structure inside `(app)/`:**
```
(app)/
  index.tsx                    ← Discover tab (renders DiscoveryFeed)
  profile.tsx
  projects/
    _layout.tsx                ← Stack navigator for projects group
    index.tsx                  ← My Projects list
    create.tsx                 ← CreateProject form
    [id]/
      insights.tsx             ← ProjectInsights + BYO-AI prompts
  chat/
    _layout.tsx                ← Stack navigator for chat group
    index.tsx                  ← Chat list (joined projects)
    [id].tsx                   ← HandshakeChat per project
```

The `projects` and `chat` tabs each have a **nested Stack layout** so `create`, `[id]/insights`, and `[id]` chat can be pushed/popped without affecting the tab bar.

### The Belfast Lock (auth domain validation)

`src/features/auth/AuthContext.tsx` is the single point of truth for authentication. On every session change it calls `validateAndApplySession()`:

1. Extracts the email domain
2. Checks it against `ALLOWED_DOMAINS` in `src/features/auth/constants.ts` (`qub.ac.uk`, `ulster.ac.uk`)
3. If invalid → calls `supabase.auth.signOut()` immediately to revoke the token server-side, sets `status = "access_restricted"`
4. If valid → upserts the `profiles` row and sets `status = "authenticated"`

**To add a new university in Phase 5:** add the domain to `ALLOWED_DOMAINS` and `DOMAIN_TO_UNIVERSITY` in `constants.ts` only — no other changes needed.

### Supabase

- Single client instance: `src/lib/supabaseClient.ts` — always import `supabase` from here, never call `createClient()` in feature code.
- Auth provider configured in Supabase dashboard as **Azure** (Microsoft Entra ID). The `prompt: "select_account"` query param forces account selection to prevent silent sign-in with personal Microsoft accounts.
- DB types are hand-authored in `src/types/database.ts`. After schema changes, regenerate with the `supabase gen types` command above.

### Database schema (key design decisions)

- `profiles.pvs_score` — stored here for fast reads; computed by telemetry Edge Functions in Phase 2, not by the client.
- `project_members.mou_accepted` — activated in Phase 1. The HandshakeChat "Sign MOU" button sets this to `true` and inserts a `mou_signed` collaboration event. Phase 3 will add the LTI verification layer on top.
- `collaboration_events` — **append-only audit log**. A Postgres trigger (`on_member_join`) auto-inserts a `join` event when a member row is created. This table is the raw data source for the PVS engine.
- Realtime is enabled on `chat_messages` and `collaboration_events` tables.
- All tables use RLS. The service role is required for any admin operations.

### Feature folder structure

```
src/features/
  auth/          ← AuthContext, useAuth hook, domain constants
  projects/
    DiscoveryFeed.tsx    ← FlashList feed with department search
    CreateProject.tsx    ← Project creation form → navigates to insights
    ProjectInsights.tsx  ← BYO-AI prompt cards (calls analyze-project Edge Function)
  chat/
    HandshakeChat.tsx    ← Realtime chat + Sign MOU button
  telemetry/     ← PVS engine — pvs/types.ts and usePVS.ts stub (Phase 2)
```

Feature code should never import across feature boundaries — route data flows via Expo Router params or Supabase queries.

### Edge Function: `analyze-project`

`supabase/functions/analyze-project/index.ts` accepts `{ project_description, looking_for?, tags? }` and returns three `sub_agent_prompts` (Legal, Tech, Marketing). These are system prompts the user pastes into their personal AI account (BYO-AI model). The function currently generates prompts locally — no external AI API call is made.

### Styling

NativeWind v4 with Tailwind. Custom tokens in `tailwind.config.js`:
- `bg-surface` / `bg-surface-card` / `border-surface-border` — dark theme base
- `text-qub-*` / `text-uu-*` — university brand colours (QUB red, UU teal)
- `bg-primary-*` — CollabSpace blue (`#3b82f6` family)

Use `className` on all RN primitives — NativeWind is configured via `babel-preset-expo` with `jsxImportSource: "nativewind"`.
