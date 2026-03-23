---
name: pvs-telemetry
description: Use when logging user actions or calculating the Project Velocity Score (PVS).
---
# PVS Telemetry Skill
## Logic
- **Append-Only:** Never delete rows from `collaboration_events`.
- **Event Types:** Log 'message_sent', 'commit_sync', 'mou_signed', and 'meeting_checkin'.
- **PVS Calculation:** Weight 'mou_signed' (10pts) higher than 'message_sent' (1pt).
## Goal
- Provide the raw data needed for Phase 4 (The Talent Oracle) to show recruiters which teams are actually shipping code.