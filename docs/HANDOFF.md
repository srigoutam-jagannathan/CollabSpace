# Hand-off: current state of CollabSpace

What is in flight, where work is tracked, and the traps that cost earlier sessions time. Refresh it with
`/handoff` at the end of a session.

_Last updated: 2026-10-03, master at b623ecf._

## Where things stand

- **The live database is in sync:** every migration in `supabase/migrations/` up to `20261002150200` is
  pushed. `supabase db diff --linked` shows only the expected `protect_bucket_control_*` triggers.
- **Not yet on GitHub:** master is about 116 commits ahead of `origin/master`, and the push needs the user's
  SSH key (`ssh-add` in their own terminal). CI has never run on GitHub.
- **QA in progress:** friends are running the QA checklist (a Claude Doc, "CollabSpace QA Checklist") over
  an Expo tunnel. Uploads are verified; connections, invites and the gmail sign-up check are still open.

## Where work is tracked

These files are local to the user's Mac and gitignored, so a session on another machine won't have them.
Ask the user if they're missing.

- `task.md` (repo root, untracked on purpose; never commit it): the backlog. The "Deploy follow-ups"
  section holds the product decisions below.
- `docs/superpowers/plans/` (gitignored): implementation plans. `2026-10-02-task-backlog.md` is done.
  `2026-10-02-security-hardening.md` is the next plan, covering the P1 items in task.md.

## Decided, not built yet (2026-10-02)

1. **Answers are final.** A connection request or invitation can only be answered while `pending`: add
   `status = 'pending'` to the USING clauses of `connections_update` and `invitations: recipient update`,
   with pgTAP tests.
2. **Joining needs an accepted invite or owner approval.** A self-join becomes a pending membership with no
   chat or media access; an accepted invitation counts as approval. Use separate member-committed and
   owner-approved fields instead of the shared `mou_accepted`. This overlaps the P1 self-approval items, so
   do it inside the security-hardening plan.
3. **Remove `devSignIn`** (the `__DEV__` bypass in `AuthContext.tsx`). It runs as anon and now sees no data.
   Use a seeded university test account instead.

## How work is done here

- **Plans, then subagent execution:** the superpowers flow — brainstorming / writing-plans, then
  subagent-driven-development, with a spec review then a code-quality review per task. Reviews have caught
  real security holes every time; don't skip them.
- **TDD.** App code: Jest via `npm run test:ci` (coverage floors enforced). Database: pgTAP files in
  `supabase/tests/database/`, run with `supabase db reset && npm run test:db`. A new policy needs an
  assertion that fails without it; a test that would pass anyway is a bug.
- **Migrations:** always a new file in `supabase/migrations/`. Never edit the baseline
  `*_remote_schema.sql`, and never edit a migration once it is pushed. Never run `supabase db push`, `link`,
  or anything against the live project without the user's explicit go-ahead.
- **Commits** end with the attribution lines your session gives you. The user merges locally; there is no PR
  flow yet.
- **The user wants terse replies** that end with a TLDR.

## Traps that cost earlier sessions time

- **Expo SDK 57 replaces global `fetch` with `expo/fetch`.** It can't send React Native's
  `{ uri, name, type }` FormData parts ("Unsupported FormDataPart implementation"). Upload files with
  `uploadJpeg()` in `src/lib/uploadImage.ts`, which reads the bytes with expo-file-system's `File` and sends
  them through `supabase.storage`.
- **Every DB fixture and test account must use a university email.** The `belfast_lock` trigger on
  `auth.users` refuses anything else, including null emails. pgTAP files model a legacy non-university
  account with `set local session_replication_role = replica`.
- **RLS tests can pass for the wrong reason.** An UPDATE that removes the actor from the row is blocked by
  SELECT visibility, not by the guard you meant to test. Keep the actor in the row.
- **Storage paths the policies expect:**
  - `avatars/<uid>.jpg` for a user's avatar.
  - `avatars/project-icons/<project id>.jpg` for a project's chat icon (owner only).
  - `project-media/<project id>/<file>` for project media (owner or member).
- **Navigation:**
  - A route inside `(tabs)` pushed from a screen above the tabs mounts a second tab navigator; keep
    detail screens and chat rooms in the root Stack.
  - `src/test/navigation.test.tsx` uses the real router (`expo-router/testing-library`). It needs
    `standard-navigation` in Jest's `transformIgnorePatterns`.
  - It also has to pass the whole `(app)/_layout` module so `unstable_settings` survives.
- **Typed routes:** `.expo/types/router.d.ts` is generated and gitignored. If type-check flags valid hrefs,
  run `npx expo start` once to regenerate it.
- **Lint warnings for `set-state-in-effect` and `preserve-manual-memoization` are deliberate.** The React
  Compiler isn't enabled, so don't "fix" these.
- **Supabase mock:** a resolver that throws now resolves as `{ error }`, as postgrest-js does. Read the header
  of `src/test/supabaseMock.ts` before testing error paths.
- **Sharing the app with remote testers:** run `npx expo start --tunnel`. The CLI and each tester's Expo Go
  must both be signed in to the throwaway Expo account `goutammm`.

## Known bugs, not fixed

- `usePVS` has no `.catch`, so a failed fetch leaves it loading forever.
- `HandshakeChat.loadData` clears `loading` only on success.
- CLAUDE.md's Styling section says to use NativeWind `className`, but most screens use inline styles with
  `useTheme` tokens. Follow the file you are editing.
