jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { db, has } from "@/test/supabaseMock";
import { fetchActive } from "./queries";

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
