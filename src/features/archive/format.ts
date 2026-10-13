/**
 * "Delivered March 2026" — the badge on every archive card.
 *
 * Month and year only. A finished project is a fact about a term, not a day,
 * and a precise date invites a precision the underlying column cannot honour
 * while delivery is inferred from updated_at.
 */
export function deliveredLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Delivered";
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  return `Delivered ${month} ${date.getFullYear()}`;
}

/** End-card line counting real (non-example) delivered projects. */
export function deliveredSummary(n: number): string {
  if (n <= 0) return "No projects delivered yet. Yours could be the first.";
  if (n === 1) return "One project delivered so far. Yours could be next.";
  return `${n} projects delivered so far. Yours could be next.`;
}

/** "4 collaborators" / "1 collaborator" — the label beside the team avatars. */
export function teamLabel(count: number): string {
  const n = Math.max(0, count);
  if (n === 0) return "No collaborators listed";
  return `${n} collaborator${n === 1 ? "" : "s"}`;
}
