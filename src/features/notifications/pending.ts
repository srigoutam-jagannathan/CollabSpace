import { supabase } from "@/lib/supabaseClient";

/** Bounds, matching the discipline in discover/queries.ts — no open reads. */
const LIMITS = { ownedProjects: 200, requests: 500 } as const;

/**
 * How many notifications are waiting for the viewer to do something.
 *
 * Only items that need a decision count: a pending connection request, a
 * pending collaboration invitation, or a join request on a project the viewer
 * owns that they have not yet approved. Things that merely happened — someone
 * approved you, someone left — are news, not a task, and do not light the dot.
 *
 * The approval rule mirrors notifications.tsx: a join request is outstanding
 * while the joiner's project_members row is still `status = 'pending'`.
 *
 * Returns 0 rather than throwing. A dot is not worth an error state, and the
 * notifications screen is the source of truth for what is actually there.
 */
export async function fetchPendingCount(viewerId: string): Promise<number> {
  try {
    const [connections, invitations, owned] = await Promise.all([
      // connections stores the pair canonically (requester_id < recipient_id),
      // so "addressed to me" is NOT recipient_id = me -- that depends purely
      // on how the two uuids sort. initiated_by is who actually asked, which
      // is what the notifications screen filters on, so match it here.
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`)
        .neq("initiated_by", viewerId)
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

    // A join request is a pending membership row on a project you own.
    // Approval (approve_member or an accepted invitation) flips it to
    // 'approved', and leaving deletes it, so neither stays counted.
    const requests = await supabase
      .from("project_members")
      .select("project_id, user_id")
      .in("project_id", ownedIds)
      .eq("status", "pending")
      // Your own row on a project you created is never a request.
      .neq("user_id", viewerId)
      .limit(LIMITS.requests);

    total += (requests.data ?? []).length;

    return total;
  } catch {
    return 0;
  }
}
