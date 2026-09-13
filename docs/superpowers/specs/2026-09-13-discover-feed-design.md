# Discover Feed — Design Spec

**Date:** 2026-09-13
**Status:** Approved, ready for implementation planning
**Mocks:** https://claude.ai/code/artifact/972afa45-cad8-43c6-82e2-85faea7e425d
**Options considered:** https://claude.ai/code/artifact/b4f62686-2ed0-48e1-b592-eac5ff3047db
**Related:** [`audit/2026-09-12-ux-audit.md`](../../../audit/2026-09-12-ux-audit.md)

---

## 1. Summary

Replace the Discover screen's Projects/Talents segmented switcher with two surfaces:

- **The Brief** — a single sectioned scroll covering live projects and people.
- **The Archive** — a full-screen deck of completed projects, where the action is
  connecting with the team that shipped them.

## 2. Goals

1. Make a catalogue of 50–200 projects feel abundant rather than sparse.
2. Drive the loop: return visit → see something relevant → act → reason to return.
3. Absorb the Talents tab so people and projects live on one surface.
4. Give completed work a home, seeding the Phase 4 recruiter portal's data surface.

## 3. Non-goals

Explicitly cut to keep this one shippable piece of work:

- No learned ranking or ML. Deterministic skill overlap only.
- No infinite scroll, daily sets, or streaks.
- No project image upload — generated visual identity covers it.
- No likes, comments, or follows on projects.
- No changes to the Talents data model; it moves into a rail.
- No changes to the Search tab.

## 4. Constraints that drove the design

| Constraint | Consequence |
|---|---|
| 50–200 projects expected in 6 months | Infinite scroll is off the table; sections create perceived depth |
| Projects have no imagery — no cover image field exists | Archive cards use deterministic generated identity |
| Only `join`, `mou_signed`, `member_quit` events fire today | Pulse is a thin strip, not a feed, until Phase 2 telemetry |
| Near-zero completed projects until ~May 2027 | Archive is gated behind a threshold and built last |
| Success = returns feeding joins | Every section ends in an action, not just a view |

---

## 5. Architecture

### 5.1 Routes

| Route | Renders | Notes |
|---|---|---|
| `app/(app)/index.tsx` | `DiscoverScreen` | Replaces `DiscoveryFeed` |
| `app/(app)/discover/[section].tsx` | `SectionListScreen` | One screen serving all "see all" destinations |
| `app/(app)/archive/index.tsx` | `ArchiveDeck` | Full screen, entered from the Shipped rail |

`discover` and `archive` are registered in `app/(app)/_layout.tsx` with
`options={{ href: null }}`, matching the existing pattern for `projects`,
`notifications`, `users/[id]` and `settings`.

Per audit finding 19, the Home tab stays visually focused while the user is
inside either of these stacks.

### 5.2 Files

```
src/features/discover/
  DiscoverScreen.tsx        composes sections, owns RefreshControl
  useDiscoverData.ts        one hook, parallel queries, stale-while-revalidate
  SectionListScreen.tsx     paginated "see all" body, switches on section key
  sections/
    PulseStrip.tsx
    NeedsYourSkills.tsx
    ActiveNow.tsx
    PeopleToKnow.tsx
    ShippedRail.tsx
src/features/archive/
  ArchiveDeck.tsx
  ArchiveCard.tsx
  ConnectTeamSheet.tsx
  generateIdentity.ts
```

`src/features/projects/DiscoveryFeed.tsx` is retired. Its `ProjectCard` and
`TalentCard` bodies are lifted into `NeedsYourSkills` and `PeopleToKnow`
respectively rather than rewritten from scratch.

---

## 6. Surface one — The Brief

Five sections, fixed order, each hidden entirely when it has nothing to show.
A hidden section renders nothing at all — no empty placeholder — so a thin
catalogue never advertises its thinness.

### 6.1 Pulse strip

- **Source:** `collaboration_events`, last 48 hours.
- **Event types:** `join` and `mou_signed` only. `member_quit` is deliberately
  excluded — a public feed of people leaving projects is socially corrosive.
- **Limit:** 10, newest first.
- **Item:** actor avatar, actor name, verb, project name. Tapping opens the project.
- **Hidden when:** zero qualifying events.

### 6.2 Needs your skills

The hero section, and the only one with full-width cards.

- **Source:** `projects` where `status = 'recruiting'`, `owner_id != me`, and the
  viewer is not already in `project_members` for that project.
- **Score:** count of `looking_for[] ∩ profiles.skills[]` for the viewer.
  Rows scoring 0 are excluded.
- **Order:** score descending, then `created_at` descending.
- **Limit:** 3.
- **Card:** matched-role callout in words ("Backend Dev — that's you"), title,
  two-line description, role meter, pills, primary CTA "Ask to join".
- **Role meter:** filled segments = `project_members` count; total segments =
  `project_members` count + `looking_for.length`.
- **Hidden when:** no project scores above 0. This is expected for users with
  empty `skills[]`, which is why the skills step in onboarding matters.

### 6.3 Active right now

- **Source:** projects with at least one `collaboration_event` in the last 7 days.
- **Order:** event count in window descending, then `project_health` descending.
- **Limit:** 10.
- **Shape:** horizontal rail, compact cards, event count shown as a live badge.
- **Hidden when:** fewer than 2 qualifying projects.

### 6.4 People to know

Absorbs the Talents tab.

- **Source:** `profiles` where `id != me` and `deleted_at IS NULL`.
- **Excluded:** anyone with an `accepted` connection to the viewer.
- **Order:** shared `department` with viewer first, then `pvs_score` descending.
- **Limit:** 10.
- **Shape:** horizontal rail of compact person cards. Tapping opens `users/[id]`.
- **Hidden when:** zero qualifying profiles.

### 6.5 Shipped from Belfast

The doorway into the Archive.

- **Source:** `projects` where `status = 'completed'`.
- **Order:** `completed_at` descending.
- **Limit:** 6 in the rail.
- **Shape:** horizontal rail of generated-identity tiles showing title, delivery
  month, and stacked team avatars.
- **Gate:** the entire section is hidden when fewer than **5** completed projects
  exist. A credibility surface showing one item damages the credibility it exists
  to build. The threshold lives in one constant so it can be tuned.
- **Tapping any tile or the section header** opens `archive/index` at that project.

### 6.6 See-all destinations

Each section header's chevron routes to `discover/[section]` with the section
key — **except Shipped from Belfast**, whose chevron opens the Archive instead,
since the Archive *is* its see-all view.

`SectionListScreen` renders a vertical `FlashList` using the same query as the
section with the limit lifted, paginated by `.range()` at 20 per page via
`onEndReached`. One screen, four configurations: pulse, needs-your-skills,
active-now, people-to-know.

---

## 7. Surface two — The Archive

### 7.1 Behaviour

Full-screen vertical pager, one completed project per screen. Entered from the
Shipped rail, exited by the back chevron, which returns to Discover scrolled to
the Shipped rail. Not a tab and not a daily ritual — a destination you choose.

- **Source:** `projects` where `status = 'completed'`, ordered `completed_at` desc.
- **Limit:** 20, paginated by 20 on reaching the end.
- **Progress:** segment bar across the top plus an `n/total` counter.
- **End state:** "That's everything shipped" with a button back to Discover.

### 7.2 Card anatomy

Top to bottom: generated identity background, shipped badge with delivery month,
project title, outcome description, "Built by" team row, proof-link chips.

- **Team row:** avatars from `project_members` → `profiles`, plus a count label.
- **Proof chips:** rendered only when the field is non-null — `github_repo_url`
  and `figma_url`. A milestone-count chip is specified but will not render until
  Phase 2 telemetry emits `milestone` events; build it behind the same non-null
  check so it appears on its own when the data arrives.

### 7.3 Actions

| Action | Behaviour |
|---|---|
| **Connect with the team** (primary) | Opens `ConnectTeamSheet` listing each member with an individual Connect button, reusing the existing `connections` insert flow. Members already connected show a "Connected" state. |
| **Save** (secondary) | Writes to `project_saves`. Optimistic, with rollback on failure. |

There is deliberately **no Skip**. In a gallery, skipping is scrolling. Omitting
it removes the need for a ranking model and reduces the new table to three columns.

**Accepted trade-off:** without a skip signal, "Needs your skills" stays
deterministic skill-overlap rather than learned ranking. At this scale the
arithmetic beats a model trained on sparse data.

### 7.4 Generated visual identity

`generateIdentity(projectId)` must be pure and deterministic — the same project
looks identical on every device and every session.

1. Hash `project.id` to a 32-bit integer (FNV-1a).
2. `hash % 6` selects one of six gradient pairs drawn from the coffee palette.
3. `(hash >> 8) % 5` selects one of five stripe angles.
4. Compose: radial highlight, repeating stripe overlay at the chosen angle, and a
   linear base gradient.

Palette pairs use only existing tokens — `#c08552`, `#d4a06a`, `#8c5a3c`,
`#6e4530`, `#4b2e2b`, `#1a0e0c` — so the archive stays inside the design system.

---

## 8. Data requirements

Everything below exists except the final two rows.

| Need | Source | Status |
|---|---|---|
| Skill matching | `projects.looking_for[]` ∩ `profiles.skills[]` | Exists |
| Role meters | `looking_for[]` + `project_members` count | Exists |
| Pulse strip | `collaboration_events` | Exists |
| Active now | event recency + `project_health` | Exists |
| People rail | `profiles`, `pvs_score`, `badges[]` | Exists |
| Archive contents | `projects.status = 'completed'` | Exists |
| Archive team | `project_members` → `profiles` | Exists |
| Proof links | `github_repo_url`, `figma_url` | Exists |
| Delivery month | `projects.completed_at` | **New column** |
| Save to revisit | `project_saves` | **New table** |

### 8.1 Migration — `completed_at`

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill existing completed rows so the archive isn't blank on day one
UPDATE projects SET completed_at = updated_at
  WHERE status = 'completed' AND completed_at IS NULL;
```

A trigger sets `completed_at = NOW()` when `status` transitions to `'completed'`
and clears it on any transition away, so the value can never contradict `status`.

### 8.2 Migration — `project_saves`

```sql
CREATE TABLE project_saves (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
```

RLS: a user may select, insert and delete only rows where `user_id = auth.uid()`.
Saves are private — no one can see what anyone else has saved.

---

## 9. States

`useDiscoverData` exposes one state per section so a single failure never blanks
the screen. This directly addresses audit finding 20, where one tab's error
replaced the other tab's content.

| State | Behaviour |
|---|---|
| **First load** | Skeleton placeholders shaped like each section. No full-screen spinner. |
| **Refetch on focus** | Existing content stays on screen; a thin progress line appears under the header. Fixes audit finding 09. |
| **Pull to refresh** | `RefreshControl` on the outer scroll refetches every section in parallel. Fixes audit finding 08. |
| **Section error** | That section only renders an inline row with the reason and a Retry that refetches just that section. Never an `Alert`. |
| **Section empty** | Section is hidden entirely. |
| **Whole screen fails** | Only when every section fails: centred message plus one Retry. |
| **Offline** | Last successful payload stays rendered with an offline banner under the header. |

Failed loads must never be presented as emptiness — audit finding 11. Every query
destructures and handles `error`.

---

## 10. Accessibility

Non-negotiable, and written into this spec because the audit found zero
accessibility props in the existing codebase (finding 03).

- Every section header is a heading: `accessibilityRole="header"`.
- Every card carries an `accessibilityLabel` summarising it in one sentence —
  e.g. "Aurora. Needs a Backend Dev, which matches your skills. 3 of 4 roles filled."
- Every interactive element has `accessibilityRole="button"` and a label. Defaults
  are added inside `Btn` so this is inherited rather than repeated.
- Minimum touch target 44×44pt, including rail cards and the archive's action row.
- The archive pager exposes `accessibilityValue={{ now, min: 1, max: total }}`.
- Reduced motion: when `AccessibilityInfo.isReduceMotionEnabled()` is true, the
  deck cross-fades instead of sliding and entrance staggers are skipped.
- Text scales with `getFontScale()`; no card clips at 200% text size — rails grow
  taller rather than truncating.

Before this ships, `Btn` must be fixed per audit finding 04, since the rails rely
on row layouts inside pressables.

---

## 11. Performance

- All five section queries run in parallel in one `Promise.all`.
- Every query is bounded by `.limit()`. No unbounded table reads — audit finding 10.
- `FlashList` for the see-all screens and the archive pager; plain views for rails,
  which hold at most 10 items.
- The archive prefetches the next two identities so gradients never pop in.
- Section data is cached in the hook and reused across focus events; a refetch
  replaces it only on success.

---

## 12. Build order

| Phase | Ships | Depends on |
|---|---|---|
| 1 | `Btn` layout fix; Brief shell with section scaffolding, pull-to-refresh, stale-while-revalidate, per-section errors | Nothing |
| 2 | Pulse strip, Needs your skills, Active now, role meters | Phase 1 |
| 3 | People rail; retire the Projects/Talents switcher and `DiscoveryFeed.tsx` | Phase 1 |
| 4 | See-all screen | Phase 2 |
| 5 | Archive deck, `completed_at`, `project_saves`, ConnectTeamSheet | ≥5 completed projects |
| Later | Pulse strip grows into a full section | Phase 2 telemetry emitting `commit` / `design_sync` |

Phases 1–4 ship against today's data. Phase 5 is deliberately last because the
archive has nothing to show until roughly May 2027.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Users with empty `skills[]` see no hero section | Onboarding already collects skills; add a prompt card in that slot inviting them to add skills |
| Archive stays empty longer than expected | It is gated and built last; nothing else depends on it |
| Rails get skimmed, lowering per-item attention | The hero section is full-width precisely to counter this; revisit if join rate does not move |
| Five parallel queries slow the first paint | All are bounded and indexed; measure before adding caching beyond the hook |

## 14. Success measures

- Join requests per weekly active user — the primary number.
- Connections initiated from the Archive — validates the surface's premise.
- Return visits per week.
- Proportion of sessions reaching any action, versus scroll-only sessions.
