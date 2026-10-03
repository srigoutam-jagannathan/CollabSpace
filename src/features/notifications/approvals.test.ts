import { visibleApprovals, type ApprovedMembershipRow } from "./approvals";

const row = (project_id: string, owner_id: string, created_at = "2026-10-03T10:00:00Z"): ApprovedMembershipRow => ({
  project_id,
  created_at,
  project: { id: project_id, title: `Project ${project_id}`, owner_id },
});

test("a project you joined and were approved for is announced", () => {
  expect(visibleApprovals([row("p1", "owner")], "me")).toEqual([
    { id: "p1_approval", projectId: "p1", projectTitle: "Project p1", createdAt: "2026-10-03T10:00:00Z" },
  ]);
});

test("your own projects are not announced: nobody approved you", () => {
  expect(visibleApprovals([row("mine", "me"), row("p1", "owner")], "me").map((a) => a.projectId)).toEqual(["p1"]);
});

test("a row whose project is missing still shows, with a fallback title", () => {
  const [approval] = visibleApprovals([{ project_id: "p2", created_at: "2026-10-01T00:00:00Z", project: null }], "me");
  expect(approval).toMatchObject({ projectId: "p2", projectTitle: "A project" });
});
