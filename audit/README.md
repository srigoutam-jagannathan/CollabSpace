# Audit

Point-in-time reviews of the CollabSpace app. Each audit is a dated, immutable
snapshot — findings are not edited as they get fixed. Track remediation in
issues or commits, and add a new audit rather than rewriting an old one.

## Index

| Date | Audit | Scope | Findings | Artifact |
|---|---|---|---|---|
| 2026-09-12 | [UI/UX Review](./2026-09-12-ux-audit.md) | Whole app — 32 routes, 27 modules, 10,645 LOC | 33 (7 blocking) | [View](https://claude.ai/code/artifact/34bac52e-0490-4ab4-8531-9956face9cbb) |

## Conventions

- **P0 — Blocking.** Broken promises, silent data loss, dead ends. Costs trust.
- **P1 — Significant friction.** Nothing broken; makes the app feel slower or
  less finished than it is.
- **P2 — Consistency & polish.** Drift around the edges of the design system.

Findings marked **verify visually** were derived from code alone and need a
simulator run to confirm.
