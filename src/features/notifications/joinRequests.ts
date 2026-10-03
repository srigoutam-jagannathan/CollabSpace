/** A `join` collaboration event as notifications.tsx selects it, newest first. */
export type JoinEventRow = {
  id: string;
  created_at: string;
  project_id: string;
  user_id: string;
  actor: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    department?: string | null;
    university?: string | null;
    skills?: string[] | null;
  } | null;
};

/** A project_members row on one of the viewer's projects. */
export type MemberRow = {
  project_id: string;
  user_id: string;
  status: "pending" | "approved";
  intro_message: string | null;
  role: string | null;
};

export type JoinRequest = {
  eventId: string;
  projectId: string;
  projectTitle: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  actorDepartment: string | null;
  actorUniversity: string | null;
  actorSkills: string[];
  introMessage: string | null;
  role: string | null;
  createdAt: string;
  isApproved: boolean;
};

/**
 * The join requests an owner sees on their projects.
 *
 * The membership row is the source of truth: `status` says whether the
 * request was approved (by approve_member, an accepted invitation or the
 * backfill), and a missing row means the person left, so the request is
 * dropped. One card per person per project, from their latest join event.
 * The owner's own join (logged when they create the project) is not a request.
 */
export function buildJoinRequests(
  events: JoinEventRow[],
  members: MemberRow[],
  projectTitles: Map<string, string>,
  viewerId: string
): JoinRequest[] {
  const memberByKey = new Map(members.map((m) => [`${m.project_id}:${m.user_id}`, m]));
  const seen = new Set<string>();
  const result: JoinRequest[] = [];
  for (const e of events) {
    if (e.user_id === viewerId) continue;
    const key = `${e.project_id}:${e.user_id}`;
    const member = memberByKey.get(key);
    if (!member || seen.has(key)) continue;
    seen.add(key);
    const actor = e.actor ?? {};
    result.push({
      eventId: e.id,
      projectId: e.project_id,
      projectTitle: projectTitles.get(e.project_id) ?? "Unknown Project",
      actorId: e.user_id,
      actorName: actor.full_name ?? "Unknown",
      actorAvatarUrl: actor.avatar_url ?? null,
      actorDepartment: actor.department ?? null,
      actorUniversity: actor.university ?? null,
      actorSkills: actor.skills ?? [],
      introMessage: member.intro_message ?? null,
      role: member.role ?? null,
      createdAt: e.created_at,
      isApproved: member.status === "approved",
    });
  }
  return result;
}
