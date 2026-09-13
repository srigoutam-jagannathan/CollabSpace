/**
 * Presentation shaping for the hero project card.
 *
 * Kept separate from ranking.ts — that file decides *which* rows appear and in
 * what order; this one decides what a single row says once it is on screen.
 * Both are pure so the card itself stays declarative.
 */
import type { NeedsItem } from "./types";

// ─── Role meter ───────────────────────────────────────────────────────────────

export type RoleMeter =
  /** Capacity is known: render segments and "n of m roles filled". */
  | { kind: "roles"; filled: number; total: number; label: string }
  /** Capacity is unknown: state the team size instead of inventing a total. */
  | { kind: "members"; label: string };

/**
 * A project only has a meaningful "n of m roles filled" reading when it
 * actually declared the roles it wants. Most projects don't — role entry is
 * optional in Create Project and routinely skipped — and for those the old
 * `total = members + roles` collapsed to the member count, so every segment
 * filled and a recruiting project rendered as "3 of 3 roles filled": fully
 * staffed, directly above an invitation to join it.
 *
 * So the meter has two shapes. With roles declared it reads as designed. With
 * none declared it reports team size, which is true, useful, and can't be
 * mistaken for capacity.
 */
export function roleMeter(memberCount: number, lookingFor: string[]): RoleMeter {
  const members = Math.max(0, memberCount);

  if (lookingFor.length > 0) {
    const total = members + lookingFor.length;
    return {
      kind: "roles",
      filled: members,
      total,
      label: `${members} of ${total} roles filled`,
    };
  }

  if (members === 0) return { kind: "members", label: "No members yet" };
  return {
    kind: "members",
    label: `${members} collaborator${members === 1 ? "" : "s"}`,
  };
}

// ─── Metadata pills ───────────────────────────────────────────────────────────

export type PillTone = "open" | "plain";
export interface Pill {
  label: string;
  tone: PillTone;
}

/** Total pills a card will render. Beyond this they wrap to a third line. */
export const MAX_PILLS = 4;

function scopeLabel(scope: NeedsItem["university_scope"]): string {
  if (scope === "qub") return "QUB";
  if (scope === "ulster") return "Ulster";
  return "QUB + Ulster";
}

/**
 * The card's metadata row, in priority order: the open role first (the reason
 * to act), then who it's open to, then the time cost, then topic tags to fill
 * any remaining space.
 *
 * The open-role pill prefers a role the viewer matches, so the pill and the
 * callout above it agree. Projects with no declared roles simply start at the
 * scope pill — there is no open role to name.
 */
export function projectPills(item: NeedsItem): Pill[] {
  const pills: Pill[] = [];

  const openRole = item.matched_roles[0] ?? item.looking_for[0];
  if (openRole) pills.push({ label: `${openRole} open`, tone: "open" });

  pills.push({ label: scopeLabel(item.university_scope), tone: "plain" });

  if (item.commitment_hours != null && item.commitment_hours > 0) {
    pills.push({ label: `${item.commitment_hours}h/wk`, tone: "plain" });
  }

  for (const tag of item.tags) {
    if (pills.length >= MAX_PILLS) break;
    pills.push({ label: tag, tone: "plain" });
  }

  return pills.slice(0, MAX_PILLS);
}
