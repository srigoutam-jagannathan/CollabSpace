jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { db, has } from "@/test/supabaseMock";
import { fetchActive, fetchNeeds, fetchPeople, fetchViewerProjectNeeds } from "./queries";

beforeEach(() => db.reset());

test("Active this week counts real team activity, not join requests, withdrawals or removals", async () => {
  db.respond((call) => {
    if (call.table === "collaboration_events") return { data: [{ project_id: "p1" }, { project_id: "p1" }] };
    if (call.table === "projects") {
      return { data: [{ id: "p1", title: "Solar Boat", description: "", project_health: null }] };
    }
    return undefined;
  });

  const result = await fetchActive();

  const [call] = db.callsTo("collaboration_events");
  expect(has(call, "in", "event_type", ["committed", "mou_signed"])).toBe(true);
  expect(result.data).toEqual([
    { id: "p1", title: "Solar Boat", description: "", project_health: null, event_count: 2 },
  ]);
});

test("your project needs are the roles and Skills Needed tags of your recruiting projects", async () => {
  db.respond((call) =>
    call.table === "projects"
      ? { data: [
          { role_requirements: [{ role: "UX Designer", description: "" }], looking_for: [], tags: ["Marketing"] },
          { role_requirements: [], looking_for: ["Legal"], tags: [] },
        ] }
      : undefined
  );
  expect(await fetchViewerProjectNeeds("me")).toEqual(["UX Designer", "Marketing", "Legal"]);
  const [call] = db.callsTo("projects");
  expect(has(call, "eq", "owner_id", "me")).toBe(true);
  expect(has(call, "eq", "status", "recruiting")).toBe(true);
});

test("People to know marks what each person can fill, and no longer orders by score", async () => {
  db.respond((call) => {
    if (call.table === "connections") return { data: [] };
    if (call.table === "profiles") {
      return { data: [{ id: "u2", full_name: "Ana", avatar_url: null, department: "Art", university: "qub", skills: ["UI/UX"] }] };
    }
    return undefined;
  });
  const result = await fetchPeople("me", ["UX Designer", "Legal"]);
  expect(result.data).toEqual([
    { id: "u2", full_name: "Ana", avatar_url: null, department: "Art", university: "qub", matched_skills: ["UX Designer"] },
  ]);
  const [call] = db.callsTo("profiles");
  expect(has(call, "order", "pvs_score")).toBe(false);
  expect(has(call, "order", "updated_at", { ascending: false })).toBe(true);
});

const MALFORMED = [
  { id: "m1", title: "A", description: "", role_requirements: {}, looking_for: null, tags: "x", project_members: [] },
  {
    id: "m2", title: "B", description: "",
    role_requirements: [{ role: 5 }, "x", null, { role: " UX Designer " }],
    looking_for: [3, " ", "Legal"], tags: ["Marketing", 7, null], project_members: [],
  },
];

test("fetchNeeds tolerates malformed role_requirements, looking_for and tags", async () => {
  db.respond((call) => (call.table === "projects" ? { data: MALFORMED } : undefined));
  const result = await fetchNeeds("me", ["UX Designer"], []);
  expect(result.error).toBeNull();
  expect(result.data.map((p) => [p.looking_for, p.tags])).toEqual([
    [[], []],
    [["UX Designer"], ["Marketing"]],
  ]);
});

test("fetchViewerProjectNeeds tolerates malformed project columns", async () => {
  db.respond((call) => (call.table === "projects" ? { data: MALFORMED } : undefined));
  expect(await fetchViewerProjectNeeds("me")).toEqual(["UX Designer", "Marketing"]);
});
