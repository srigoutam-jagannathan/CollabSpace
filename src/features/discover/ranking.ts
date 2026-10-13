import { canonicalSkill } from "@/constants/skills";
import { EXAMPLE_SHIPPED, SHIPPED_MINIMUM } from "@/constants/exampleShipped";
import type { ActiveItem, NeedsItem, PersonItem, SectionKey, ShippedItem } from "./types";

/** Faces stacked on a Shipped tile. Matches RAIL_FACES in queries.ts. */
const RAIL_FACES = 4;

/** Section limits, from the spec. */
export const LIMITS: Record<SectionKey, number> = {
  needs: 3,
  active: 10,
  people: 10,
  shipped: 6,
};

/** Minimum item count for a section to render at all. */
const MIN_ITEMS: Record<SectionKey, number> = {
  needs: 1,
  active: 2,
  people: 1,
  // The archive is a credibility surface, and one showing a single item
  // damages the credibility it exists to build. Until five real projects
  // have shipped, withExampleShipped tops the rail up to five with labelled
  // examples, so the gate is always met.
  shipped: SHIPPED_MINIMUM,
};

/**
 * What a project needs that the viewer can fill: its roles first, then its
 * Skills Needed tags, compared by canonical skill (so "Frontend Developer"
 * meets "Coding and Development"). The first argument is what is needed
 * (project roles, or a viewer's project needs) and the result is drawn from
 * it, in that wording, one entry per distinct skill. Blank entries are skipped.
 */
export function matchedRoles(lookingFor: string[], skills: string[], tags: string[] = []): string[] {
  const owned = new Set(skills.map((s) => canonicalSkill(s).toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const need of [...lookingFor, ...tags]) {
    const key = canonicalSkill(need).toLowerCase();
    if (key && owned.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(need);
    }
  }
  return out;
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

/** Real shipped projects first, topped up with labelled examples to SHIPPED_MINIMUM. */
export function withExampleShipped(real: ShippedItem[]): ShippedItem[] {
  const needed = Math.max(0, SHIPPED_MINIMUM - real.length);
  const examples: ShippedItem[] = EXAMPLE_SHIPPED.slice(0, needed).map((e) => ({
    id: e.id,
    title: e.title,
    delivered_at: e.delivered_at,
    cover_url: null,
    faces: e.team.slice(0, RAIL_FACES).map((name, i) => ({ id: `${e.id}-${i}`, full_name: name, avatar_url: null })),
    is_example: true,
  }));
  return [...real, ...examples];
}
