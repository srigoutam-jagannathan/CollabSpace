import { supabase } from "@/lib/supabaseClient";

/** Bounds, matching the discipline in discover/queries.ts — no open reads. */
const LIMITS = { ownedProjects: 200, events: 500 } as const;

/**
 * How many notifications are waiting for the viewer to do something.
 *
 * Only items that need a decision count: a pending connection request, a
 * pending collaboration invitation, or a join request on a project the viewer
 * owns that they have not yet approved. Things that merely happened — someone
 * approved you, someone left — are news, not a task, and do not light the dot.
 *
 * The approval rule mirrors notifications.tsx: an owner approving a member
 * writes a `mou_signed` event with `metadata.approved_for` set to that member.
 * A join event with no matching approval is still outstanding.
 *
 * Returns 0 rather than throwing. A dot is not worth an error state, and the
 * notifications screen is the source of truth for what is actually there.
 */
export async function fetchPendingCount(viewerId: string): Promise<number> {
  try {
    const [connections, invitations, owned] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", viewerId)
        .eq("status", "pending"),
      supabase
        .from("collab_invitations")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", viewerId)
        .eq("status", "pending"),
      supabase
        .from("projects")
        .select("id")
        .eq("owner_id", viewerId)
        .limit(LIMITS.ownedProjects),
    ]);

    let total = (connections.count ?? 0) + (invitations.count ?? 0);

    const ownedIds = (owned.data ?? []).map((p: any) => p.id);
    if (ownedIds.length === 0) return total;

    const [joins, approvals] = await Promise.all([
      supabase
        .from("collaboration_events")
        .select("project_id, user_id")
        .in("project_id", ownedIds)
        .eq("event_type", "join")
        .limit(LIMITS.events),
      supabase
        .from("collaboration_events")
        .select("project_id, metadata")
        .in("project_id", ownedIds)
        .eq("event_type", "mou_signed")
        .eq("user_id", viewerId)
        .limit(LIMITS.events),
    ]);

    const approved = new Set<string>(
      (approvals.data ?? [])
        .filter((e: any) => e.metadata?.approved_for)
        .map((e: any) => `${e.project_id}:${e.metadata.approved_for}`)
    );

    total += (joins.data ?? []).filter(
      (e: any) => !approved.has(`${e.project_id}:${e.user_id}`)
    ).length;

    return total;
  } catch {
    return 0;
  }
}
