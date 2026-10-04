export interface Deps {
  userIdFromJwt(authHeader: string | null): Promise<string | null>;
  /**
   * Atomically marks the caller's latest unclaimed member_quit on the
   * project since sinceIso as notified. False if there is none, or if the
   * owner was already told about this leaver on this project since then.
   */
  claimQuit(projectId: string, userId: string, sinceIso: string): Promise<boolean>;
  project(projectId: string): Promise<{ owner_id: string; title: string } | null>;
  displayName(userId: string): Promise<string | null>;
  pushToken(userId: string): Promise<string | null>;
  sendPush(msg: { to: string; title: string; body: string }): Promise<unknown>;
  now(): Date;
}

export type Result = { status: number; body: Record<string, unknown> };

/** How long after leaving the leaver may trigger the push; also the per-leaver limit. */
const QUIT_WINDOW_MS = 10 * 60_000;

/** A non-UUID would make the uuid-column queries error (a 500); refuse it up front. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tells a project owner that a member left. The recipient and the text both
 * come from the database: callers only say which project, and only someone
 * who just logged member_quit on it (via leave_project) may trigger the push,
 * once per quit and at most once per window per leaver and project.
 */
export async function handle(authHeader: string | null, input: unknown, d: Deps): Promise<Result> {
  const caller = await d.userIdFromJwt(authHeader);
  if (!caller) return { status: 401, body: { error: "unauthenticated" } };

  const projectId = (input as { projectId?: unknown } | null)?.projectId;
  if (typeof projectId !== "string" || !UUID.test(projectId)) {
    return { status: 400, body: { error: "projectId required" } };
  }

  const since = new Date(d.now().getTime() - QUIT_WINDOW_MS).toISOString();
  if (!(await d.claimQuit(projectId, caller, since))) {
    return { status: 403, body: { error: "nothing to notify" } };
  }

  const project = await d.project(projectId);
  if (!project) return { status: 404, body: { error: "no such project" } };
  if (project.owner_id === caller) return { status: 200, body: { sent: false, reason: "self" } };

  const token = await d.pushToken(project.owner_id);
  if (!token) return { status: 200, body: { sent: false, reason: "no_token" } };

  const name = (await d.displayName(caller)) || "A member";
  await d.sendPush({ to: token, title: `${name} left ${project.title}`, body: `${name} has left the project.` });
  return { status: 200, body: { sent: true } };
}
