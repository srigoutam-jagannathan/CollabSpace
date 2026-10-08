# Hand-off: current state of CollabSpace

What is in flight, where work is tracked, and the traps that cost earlier sessions time. Refresh it with
`/handoff` at the end of a session.

_Last updated: 2026-10-04, master at 65fa130._

## Where things stand

- **Phases 0 (honest profile) and 1 (security hardening) are live** and were checked on a device on 2026-10-04.
  The live database has every migration up to `20261003100710`. `notify-owner` and `delete-account` are deployed.
  `supabase db diff --linked` shows only the expected `protect_bucket_control_*` triggers.
- **GitHub:** master is pushed and CI passes. Pushing needs the user's SSH key (`ssh-add` in their own terminal).
  QA file bugs and change requests as GitHub Issues (forms in `.github/ISSUE_TEMPLATE/`); the repo is public.
- **Next:** Phase 1b (in-app notifications), 2 (skill matching) or 3 (quick wins). The user picks.
- **Leftover worktree:** `.claude/worktrees/p1-security` is fully merged and can be deleted when the user agrees.

## Where work is tracked

These files exist only on the user's Mac (gitignored); ask if they're missing.

- `task.md` (repo root, never commit it): the backlog. Its "Build roadmap" section lists each phase, the user's
  decisions and the open questions.
- `docs/superpowers/plans/2026-10-03-p*.md`: one plan per phase.
  - P0 and P1 are done.
  - P1b, P2, P3 and P4 are ready to run.
  - P5 is an outline, to be expanded once Phase 4 has shipped.
  - Plans dated before 2026-10-03 are done or superseded.

## How work is done here

- **Plans, then subagent execution.** Use writing-plans, then subagent-driven-development. Every task gets a
  spec review and a code-quality or security review, and every phase gets a final adversarial review. Reviews
  found real security holes in every phase; don't skip them.
- **TDD.**
  - App code: Jest via `npm run test:ci`, with coverage floors enforced.
  - Database: pgTAP in `supabase/tests/database/`.
  - Edge functions: `deno test supabase/functions/`.
  - A new rule needs an assertion that fails without it.
- **Migrations.** Always add a new file. Never edit a migration once it's pushed. Never run `db push`,
  `link` or `functions deploy` without the user's explicit go-ahead.
- **Commits** end with your session's attribution lines. The user merges locally; there is no PR flow.
- **Testers run the app from the main folder via the Expo tunnel.** Build any phase whose app code needs
  unpushed migrations in a worktree under `.claude/worktrees/`, so testers keep a working build. At rollout,
  push the database, deploy the functions and switch testers to the new build together. The old build breaks
  as soon as the new rules are live.
- **The user wants terse replies** that end with a TLDR.

## Traps that cost earlier sessions time

- **The Supabase CLI names local containers after the folder name.** In a worktree, `supabase db reset`
  fails with "No such container: supabase_db_<folder>".
  - Fix: run DB commands from a symlink to the worktree whose folder is named `CollabSpace`, for example
    `ln -sfn <worktree> /private/tmp/claude-501/wt/CollabSpace`.
  - For live commands, copy `supabase/.temp` into the worktree; that's where the project link lives.
- **Expo SDK 57's `fetch` can't send React Native `{ uri, name, type }` FormData parts.** Upload with
  `uploadJpeg()` in `src/lib/uploadImage.ts`.
- **Every DB fixture and test account must use a university email.** The `belfast_lock` trigger refuses
  anything else. Model a legacy account with `set local session_replication_role = replica`; that also skips
  `trg_new_user`, so insert its `profiles` row yourself.
- **RLS tests can pass for the wrong reason.** If an UPDATE removes the actor from the row, SELECT visibility
  blocks it instead of the guard. Keep the actor in the row.
- **A new enum value needs its own migration file.** Postgres can't use it in the transaction that adds it.
- **Storage paths the policies expect:**
  - `avatars/<uid>.jpg`
  - `avatars/project-icons/<project id>.jpg` (owner only)
  - `project-media/<project id>/<file>` (owner or approved member)
- **Navigation:** a route inside `(tabs)` pushed from above the tabs mounts a second tab navigator, so keep
  detail screens and chat rooms in the root Stack. `src/test/navigation.test.tsx` uses the real router.
- **Typed routes:** `.expo/types/router.d.ts` is generated. If type-check rejects valid hrefs, run
  `npx expo start` once.
- **Lint warnings for `set-state-in-effect` and `preserve-manual-memoization` are deliberate.** The React
  Compiler isn't enabled.
- **Supabase mock:** a throwing resolver resolves as `{ error }`, as postgrest-js does. Read the header of
  `src/test/supabaseMock.ts` before testing error paths.
- **Remote testers:** run `npx expo start --tunnel` with the CLI signed in as `goutammm`; each tester's Expo Go
  signs in as `goutammm` too. Started in the background, Expo prints no QR code. Get the URL from
  `curl -s 127.0.0.1:4040/api/tunnels`.

## Known bugs, not fixed

- `usePVS` has no `.catch`, so a failed fetch leaves it loading forever.
- `HandshakeChat.loadData` clears `loading` only on success.
- CLAUDE.md's Styling section says to use NativeWind `className`, but most screens use inline styles with
  `useTheme` tokens. Follow the file you're editing.
