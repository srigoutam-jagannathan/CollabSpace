import type { ActiveItem, NeedsItem, PersonItem, SectionKey } from "./types";

/** Section limits, from the spec. */
export const LIMITS: Record<SectionKey, number> = {
  pulse: 10,
  needs: 3,
  active: 10,
  people: 10,
};

/** Minimum item count for a section to render at all. */
const MIN_ITEMS: Record<SectionKey, number> = {
  pulse: 1,
  needs: 1,
  active: 2,
  people: 1,
};

/**
 * Roles a project still needs that the viewer can actually fill.
 * Compared case-insensitively — skills are free text from onboarding.
 * Returned in the project's original casing/wording, not the viewer's.
 */
export function matchedRoles(lookingFor: string[], skills: string[]): string[] {
  const owned = new Set(skills.map(s => s.trim().toLowerCase()));
  return lookingFor.filter(role => owned.has(role.trim().toLowerCase()));
}

/**
 * Highest overlap first. Rows with no overlap are excluded entirely.
 * `limit` defaults to the section cap; the see-all screen passes Infinity.
 */
export function rankNeeds(rows: NeedsItem[], limit: number = LIMITS.needs): NeedsItem[] {
  return rows
    .filter(r => r.matched_roles.length > 0)
    .sort((a, b) => b.matched_roles.length - a.matched_roles.length)
    .slice(0, limit);
}

/** Which mode the hero section is showing. */
export type NeedsMode = "matched" | "recent";

/**
 * The hero section has two modes. Normally it shows projects needing a role the
 * viewer can fill. When nothing matches — common, since most projects are
 * created without roles — it falls back to the newest recruiting projects so
 * the screen is never empty of projects, and the caller retitles the section.
 *
 * `rows` arrive newest-first from the query, so the fallback is just a slice.
 */
export function selectNeeds(
  rows: NeedsItem[],
  limit: number = LIMITS.needs
): { items: NeedsItem[]; mode: NeedsMode } {
  const matched = rankNeeds(rows, limit);
  if (matched.length > 0) return { items: matched, mode: "matched" };
  return { items: rows.slice(0, limit), mode: "recent" };
}

/** Most activity first; project_health breaks ties. */
export function rankActive(rows: ActiveItem[], limit: number = LIMITS.active): ActiveItem[] {
  return [...rows]
    .sort((a, b) =>
      b.event_count - a.event_count ||
      (b.project_health ?? 0) - (a.project_health ?? 0)
    )
    .slice(0, limit);
}

/** Same department first, then higher PVS. */
export function rankPeople(
  rows: PersonItem[],
  viewerDepartment: string | null,
  limit: number = LIMITS.people
): PersonItem[] {
  const dept = viewerDepartment?.trim().toLowerCase() ?? null;
  const shares = (p: PersonItem) =>
    dept !== null && p.department?.trim().toLowerCase() === dept ? 1 : 0;

  return [...rows]
    .sort((a, b) => shares(b) - shares(a) || b.pvs_score - a.pvs_score)
    .slice(0, limit);
}

/**
 * A section with too little to say renders nothing at all — no empty
 * placeholder. A thin catalogue should never advertise its thinness.
 */
export function sectionVisible(key: SectionKey, itemCount: number): boolean {
  return itemCount >= MIN_ITEMS[key];
}
