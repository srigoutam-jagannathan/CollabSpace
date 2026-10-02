jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { fetchPendingCount } from "./pending";
import { db, has, type QueryCall } from "@/test/supabaseMock";

const ME = "me";

type Join = { project_id: string; user_id: string };
type Approval = { project_id: string; metadata: Record<string, string> };

function world({
  connections = 0,
  invitations = 0,
  owned = [] as string[],
  joins = [] as Join[],
  approvals = [] as Approval[],
} = {}) {
  db.respond((c: QueryCall) => {
    if (c.table === "connections") return { count: connections };
    if (c.table === "collab_invitations") return { count: invitations };
    if (c.table === "projects") return { data: owned.map((id) => ({ id })) };
    if (c.table === "collaboration_events" && has(c, "eq", "event_type", "join")) return { data: joins };
    if (c.table === "collaboration_events" && has(c, "eq", "event_type", "mou_signed")) return { data: approvals };
    return undefined;
  });
}

const approved = (project_id: string, approved_for: string): Approval => ({
  project_id,
  metadata: { approved_for },
});

beforeEach(() => db.reset());

test("sums pending connection requests and invitations", async () => {
  world({ connections: 2, invitations: 1 });
  expect(await fetchPendingCount(ME)).toBe(3);
});

test("does not query events at all when you own no projects", async () => {
  world({ connections: 1 });
  await fetchPendingCount(ME);
  expect(db.callsTo("collaboration_events")).toHaveLength(0);
});

test("counts join requests on your projects that you have not approved", async () => {
  world({
    owned: ["p1"],
    joins: [{ project_id: "p1", user_id: "ana" }, { project_id: "p1", user_id: "ben" }],
    approvals: [approved("p1", "ana")],
  });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("approving someone on one project does not clear their request on another", async () => {
  world({
    owned: ["p1", "p2"],
    joins: [{ project_id: "p1", user_id: "ana" }, { project_id: "p2", user_id: "ana" }],
    approvals: [approved("p1", "ana")],
  });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("an approval event with no approved_for clears nothing", async () => {
  world({
    owned: ["p1"],
    joins: [{ project_id: "p1", user_id: "ana" }],
    approvals: [{ project_id: "p1", metadata: {} }],
  });
  expect(await fetchPendingCount(ME)).toBe(1);
});

test("only your own approvals count", async () => {
  world({ owned: ["p1"] });
  await fetchPendingCount(ME);
  const approvalsQuery = db.callsTo("collaboration_events").find((c) => has(c, "eq", "event_type", "mou_signed"))!;
  expect(has(approvalsQuery, "eq", "user_id", ME)).toBe(true);
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

test("returns 0 instead of throwing when the network fails", async () => {
  db.respond(() => {
    throw new Error("offline");
  });
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("returns 0 instead of throwing when a query rejects outright", async () => {
  db.strict();
  expect(await fetchPendingCount(ME)).toBe(0);
});

test("only projects you own are considered, and events are scoped to them", async () => {
  world({ owned: ["p1"] });
  await fetchPendingCount(ME);
  expect(has(db.callsTo("projects")[0], "eq", "owner_id", ME)).toBe(true);
  const events = db.callsTo("collaboration_events");
  expect(events).toHaveLength(2);
  for (const c of events) expect(has(c, "in", "project_id", ["p1"])).toBe(true);
});
