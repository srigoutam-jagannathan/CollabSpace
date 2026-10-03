---
name: handoff
description: Refresh docs/HANDOFF.md at the end of a session so the next session starts with the current state. Run only when the user types /handoff.
disable-model-invocation: true
---

# /handoff: refresh docs/HANDOFF.md

Every session loads `docs/HANDOFF.md` through `CLAUDE.md`, so each line costs every future session tokens.
The goal is a file that is **current and short**, not complete.

## 1. Gather (read, don't write yet)

- `docs/HANDOFF.md` as it stands. Note the SHA on its "Last updated" line.
- `git log --oneline <that SHA>..HEAD` and `git status --short`: what changed since the last refresh.
- `task.md` (if present): decisions and open items.
- This session's conversation: decisions the user made, things verified, traps hit.

## 2. Decide each line with two questions

Keep or add a line only if BOTH answers are yes:

1. **Would a fresh session act wrongly or waste real time without it?**
2. **Is it NOT already discoverable from** CLAUDE.md, the code, `git log`, `task.md`, or a test name?

Everything else goes. In particular:

- No session narrative, commit lists, review back-and-forth, file-by-file change logs or test counts.
- Nothing CLAUDE.md already says. A rule that is now permanent belongs in CLAUDE.md: list it in your report as a
  suggestion; don't put it here.
- No secrets, keys, emails or personal details.

## 3. Rewrite, don't append

Keep these sections, in this order. Drop a section that has nothing left in it.

| Section | Holds | Remove when |
| --- | --- | --- |
| Where things stand | What's live, what's mid-flight, what's blocked on the user | It's done and nothing depends on knowing it |
| Where work is tracked | Paths to the backlog and plans, and which are local-only | The path changes |
| Decided, not built yet | User decisions, each with how to build it | It's built |
| How work is done here | Workflow and safety rules not in CLAUDE.md | It moves to CLAUDE.md |
| Traps | Verified gotchas that still bite | The code fixes it and a test guards it |
| Known bugs, not fixed | One line each | It's fixed, or it's tracked in `task.md` |

Writing rules:

- **Current truth only:** edit stale lines in place; never add a "now X" line beside an outdated one.
- **Verify before keeping:** check that each named path, command or symbol still exists (grep or ls). Drop or
  fix anything that doesn't.
- **One line per item where you can.** A trap is the symptom plus the fix, not the story of finding it.
- **Budget:** at most 900 words (`wc -w docs/HANDOFF.md`). If you're over, cut the lowest-value lines first.
  Never let the budget push out a still-true safety rule.
- Set the "Last updated" line to today's date and `git rev-parse --short HEAD`.

## 4. Finish

1. Show the user `git diff --stat docs/HANDOFF.md` and the word count before → after. Name anything removed
   that they might want kept.
2. Commit only `docs/HANDOFF.md`, with the message `docs(handoff): refresh for <today>` plus the session's
   attribution lines. Never push, and never stage other files.
3. List any CLAUDE.md suggestions from step 2, without applying them.
