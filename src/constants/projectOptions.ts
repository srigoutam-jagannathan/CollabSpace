/**
 * Choices offered when creating a project. `value` is what's stored; `label`
 * is what the tile says. Stored type values predate the step-by-step form and
 * Search filters on them, so only labels may change.
 */
export const PROJECT_TYPES = [
  { value: "Academic Project", label: "Academic", hint: "Coursework, research, dissertations" },
  { value: "Side Project", label: "Passion project", hint: "Something you want to exist" },
  { value: "Startup", label: "Startup", hint: "A business idea" },
  { value: "Community", label: "Community", hint: "Societies, events, causes" },
] as const;

/** Must match the projects_duration_check constraint. */
export const DURATIONS = [
  { value: "under_1_month", label: "Less than a month" },
  { value: "1_3_months", label: "1–3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "flexible", label: "Flexible" },
] as const;
export type Duration = (typeof DURATIONS)[number]["value"];

/** Stored in projects.collaboration_style. */
export const COLLAB_STYLES = ["Remote", "In-Person", "Hybrid"] as const;
export type CollabStyle = (typeof COLLAB_STYLES)[number];

/** Weekly hours, stored in projects.commitment_hours. */
export const COMMITMENT_HOURS = [2, 5, 10, 15] as const;

export function durationLabel(value: string | null | undefined): string | null {
  return DURATIONS.find((d) => d.value === value)?.label ?? null;
}
