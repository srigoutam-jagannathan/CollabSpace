/**
 * Project Velocity Score (PVS) — Phase 2 type definitions.
 *
 * The PVS is a 0–100 composite metric that proves team cohesion and
 * output quality to external stakeholders (recruiters, grant bodies).
 *
 * Scoring dimensions (weights TBD in Phase 2):
 *   - Commit cadence (GitHub integration)
 *   - Design iteration rate (Figma integration)
 *   - Team communication health (chat event frequency)
 *   - Milestone completion rate
 *   - Cross-university collaboration bonus
 */

export interface PVSBreakdown {
  total: number;                   // 0–100 composite
  commit_cadence: number;          // 0–25
  design_iteration: number;        // 0–20
  communication_health: number;    // 0–25
  milestone_completion: number;    // 0–20
  cross_university_bonus: number;  // 0–10
}

export interface PVSSnapshot {
  project_id: string;
  computed_at: string;
  breakdown: PVSBreakdown;
  delta_7d: number;               // Score change over last 7 days
  percentile: number | null;      // vs all CollabSpace projects (Phase 2)
}
