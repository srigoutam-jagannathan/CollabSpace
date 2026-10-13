const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TimeframeSource {
  start_date?: string | null;
  end_date?: string | null;
  commitment_hours?: number | null;
}

/**
 * "2026-10-03" → "Oct 2026". Parsed by hand, not with Date or toLocaleString,
 * so the result doesn't depend on the phone's timezone or locale.
 */
function monthYear(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

/**
 * One line saying when a project runs and how much time it asks for, or null
 * when the project says neither. Shown on the join screen and the create preview.
 */
export function describeTimeframe(p: TimeframeSource): string | null {
  const start = monthYear(p.start_date);
  const end = monthYear(p.end_date);

  // ISO dates compare lexically. An end before the start is a mistake; don't print it backwards.
  const reversed = start && end && p.end_date! < p.start_date!;

  let when: string | null = null;
  if (start && end && !reversed) when = start === end ? start : `${start} – ${end}`;
  else if (start) when = `From ${start}`;
  else if (end && !start) when = `Until ${end}`;

  const h = p.commitment_hours ?? 0;
  const hours = h > 0 ? `${h} ${h === 1 ? "hr" : "hrs"} a week` : null;

  const parts = [when, hours].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
