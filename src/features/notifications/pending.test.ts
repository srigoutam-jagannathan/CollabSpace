jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { fetchPendingCount } from "./pending";
import { db, has, rejectWith, type QueryCall } from "@/test/supabaseMock";

const ME = "me";

type Member = { project_id: string; user_id: string; status: "pending" | "approved" };

/** Applies the eq / neq / in filters the query used, the way the database would. */
function matching(rows: Member[], c: QueryCall): Member[] {
  return rows.filter((r) =>
    c.filters.every(([method, column, value]) => {
      const field = (r as Record<string, unknown>)[column as string];
      if (method === "eq") return field === value;
      if (method === "neq") return field !== value;
      if (method === "in") return (value as unknown[]).includes(field);
      return true;
    })
  );
}

function world({
  connections = 0,
  invitations = 0,
  owned = [] as string[],
  members = [] as Member[],
} = {}) {
  db.respond((c: QueryCall) => {
    if (c.table === "connections") return { count: connections };
    if (c.table === "collab_invitations") return { count: invitations };
    if (c.table === "projects") return { data: owned.map((id) => ({ id })) };
    if (c.table === "project_members") return { data: matching(members, c) };
    return undefined;
  });
}

const pending = (project_id: string, user_id: string): Member => ({ project_id, user_id, status: "pending" });
const approved = (project_id: string, user_id: string): Member => ({ project_id, user_id, status: "approved" });

beforeEach(() => db.reset());

test("sums pending connection requests and invitations", async () => {
  world({ connections: 2, invitations: 1 });
  expect(await fetchPendingCount(ME)).toBe(3);
});

test("does not query memberships at all when you own no projects", async () => {
  world({ connections: 1 });
  await fetchPendingCount(ME);
  expect(db.callsTo("project_members")).toHaveLength(0);
});

test("counts pending join requests on your projects, not approved members", async () => {
  world({ owned: ["p1"], members: [approved("p1", "ana"), pending("p1", "ben")] });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("an invitee who accepted is already approved, so is not a request", async () => {
  // accept_invitation inserts the row approved and logs no mou_signed event,
  // so the old event-based rule counted them forever.
  world({ owned: ["p1"], members: [approved("p1", "ivy")] });
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("someone who asked to join and then left is not a request", async () => {
  // Their join event stays in the audit log, but their membership row is gone.
  world({ owned: ["p1"], members: [] });
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("your own membership on a project you created is not a request to approve", async () => {
  // QA saw "approve yourself" (2026-10-03). The owner's row is inserted
  // approved, but it is excluded outright rather than relying on that.
  world({ owned: ["p1"], members: [pending("p1", ME), pending("p1", "ana")] });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("approving someone on one project does not clear their request on another", async () => {
  world({ owned: ["p1", "p2"], members: [approved("p1", "ana"), pending("p2", "ana")] });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("connection requests match either side of the canonical pair, by who did not initiate", async () => {
  world();
  await fetchPendingCount(ME);
  const [connections] = db.callsTo("connections");
  expect(has(connections, "or", `requester_id.eq.${ME},recipient_id.eq.${ME}`)).toBe(true);
  expect(has(connections, "neq", "initiated_by", ME)).toBe(true);
  expect(has(connections, "eq", "status", "pending")).toBe(true);
  // The bug fixed in 5e275e1: matching recipient_id alone missed every
  // request where the uuids happened to sort the other way.
  expect(has(connections, "eq", "recipient_id", ME)).toBe(false);
});

test("returns 0 when queries come back with a network error", async () => {
  db.respond((c) => {
    if (c.table === "projects") return { data: [{ id: "p1" }] };
    throw new TypeError("offline");
  });
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("a query that rejects (throwOnError or a bug) still yields 0", async () => {
  db.respond(() => rejectWith(new Error("boom")));
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("only projects you own are considered, and requests are scoped to them", async () => {
  world({ owned: ["p1"] });
  await fetchPendingCount(ME);
  expect(has(db.callsTo("projects")[0], "eq", "owner_id", ME)).toBe(true);
  const [requests] = db.callsTo("project_members");
  expect(has(requests, "in", "project_id", ["p1"])).toBe(true);
  expect(has(requests, "eq", "status", "pending")).toBe(true);
  expect(has(requests, "neq", "user_id", ME)).toBe(true);
  expect(db.callsTo("collaboration_events")).toHaveLength(0);
});
