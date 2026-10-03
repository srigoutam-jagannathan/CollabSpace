/** An approved project_members row as notifications.tsx selects it. */
export type ApprovedMembershipRow = {
  project_id: string;
  created_at: string | null;
  project: { id: string; title: string | null; owner_id: string } | null;
};

/** One "You've been approved!" card. */
export type MyApproval = {
  id: string;
  projectTitle: string;
  projectId: string;
  createdAt: string;
};

/**
 * The "You've been approved!" cards for the viewer.
 *
 * An owner's own membership row is approved (CreateProject inserts it that
 * way), but nobody approved them, so their own projects are left out.
 */
export function visibleApprovals(rows: ApprovedMembershipRow[], viewerId: string): MyApproval[] {
  return rows
    .filter((m) => m.project?.owner_id !== viewerId)
    .map((m) => ({
      id: `${m.project_id}_approval`,
      projectTitle: m.project?.title ?? "A project",
      projectId: m.project_id,
      createdAt: m.created_at ?? new Date().toISOString(),
    }));
}
