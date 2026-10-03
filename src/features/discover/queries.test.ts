jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { db, has } from "@/test/supabaseMock";
import { fetchPulse } from "./queries";

beforeEach(() => db.reset());

test("Pulse asks only for commitments: no owner approvals, no pending join requests", async () => {
  db.respond((call) =>
    call.table === "collaboration_events"
      ? {
          data: [{
            id: "e1", created_at: "2026-10-04T10:00:00Z", event_type: "committed", project_id: "p1",
            projects: { title: "Solar Boat" },
            profiles: { id: "u2", full_name: "Aoife Byrne", avatar_url: null },
          }],
        }
      : undefined
  );

  const result = await fetchPulse();

  const [call] = db.callsTo("collaboration_events");
  expect(has(call, "in", "event_type", ["committed"])).toBe(true);
  expect(result).toEqual({
    data: [{
      id: "e1", created_at: "2026-10-04T10:00:00Z", event_type: "committed", project_id: "p1",
      project_title: "Solar Boat", actor_id: "u2", actor_name: "Aoife Byrne", actor_avatar_url: null,
    }],
    error: null,
  });
});
