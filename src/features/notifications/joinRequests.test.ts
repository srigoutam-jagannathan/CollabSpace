import { buildJoinRequests, type JoinEventRow, type MemberRow } from "./joinRequests";

const ME = "me";
const titles = new Map([["p1", "Lumen"], ["p2", "Aurora"]]);

const join = (id: string, project_id: string, user_id: string, created_at = "2026-10-03T10:00:00Z"): JoinEventRow => ({
  id, project_id, user_id, created_at,
  actor: { id: user_id, full_name: `Name ${user_id}`, avatar_url: null, department: null, university: null, skills: [] },
});
const member = (project_id: string, user_id: string, status: "pending" | "approved"): MemberRow => ({
  project_id, user_id, status, intro_message: null, role: "Dev",
});

const build = (events: JoinEventRow[], members: MemberRow[]) => buildJoinRequests(events, members, titles, ME);

test("a pending joiner is a request still to approve", () => {
  const [req] = build([join("e1", "p1", "ana")], [member("p1", "ana", "pending")]);
  expect(req).toMatchObject({ eventId: "e1", projectId: "p1", projectTitle: "Lumen", actorId: "ana", isApproved: false, role: "Dev" });
});

test("approval follows the membership status, so invitees and backfilled members show as approved", () => {
  // Neither has an owner mou_signed event: accept_invitation writes none, and
  // the backfill approved committed members without one.
  const reqs = build([join("e1", "p1", "ivy"), join("e2", "p1", "bo")], [member("p1", "ivy", "approved"), member("p1", "bo", "approved")]);
  expect(reqs.map((r) => r.isApproved)).toEqual([true, true]);
});

test("someone who left (no membership row any more) is dropped", () => {
  expect(build([join("e1", "p1", "ana")], [])).toEqual([]);
});

test("your own join on a project you created is not a request", () => {
  expect(build([join("e1", "p1", ME)], [member("p1", ME, "approved")])).toEqual([]);
});

test("status is per project", () => {
  const reqs = build([join("e1", "p1", "ana"), join("e2", "p2", "ana")], [member("p1", "ana", "approved"), member("p2", "ana", "pending")]);
  expect(reqs.map((r) => [r.projectId, r.isApproved])).toEqual([["p1", true], ["p2", false]]);
});

test("someone who left and asked again appears once, from their latest join", () => {
  // Events arrive newest first; the older join is from the earlier membership.
  const reqs = build(
    [join("new", "p1", "ana", "2026-10-03T12:00:00Z"), join("old", "p1", "ana", "2026-10-01T12:00:00Z")],
    [member("p1", "ana", "pending")]
  );
  expect(reqs.map((r) => r.eventId)).toEqual(["new"]);
});
