import { buildConnectionRequests, type ConnectionRequestRow } from "./connectionRequests";

const A = "a", B = "b", C = "c";

function row(over: Partial<ConnectionRequestRow>): ConnectionRequestRow {
  return {
    id: "c1",
    requester_id: A,
    recipient_id: B,
    initiated_by: A,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    requester: { full_name: "Alice", avatar_url: "a.png" },
    recipient: { full_name: "Bob", avatar_url: "b.png" },
    ...over,
  };
}

test("a reopened request shows when it was sent again, not when the row was first made", () => {
  const [req] = buildConnectionRequests([
    row({ created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-03T12:00:00Z" }),
  ]);
  expect(req.createdAt).toBe("2026-10-03T12:00:00Z");
});

test("newest sent first, by updated_at", () => {
  const reqs = buildConnectionRequests([
    row({ id: "old", created_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z" }),
    // Created long ago, reopened today: it belongs at the top.
    row({ id: "reopened", requester_id: A, recipient_id: C, created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-10-03T00:00:00Z" }),
  ]);
  expect(reqs.map(r => r.id)).toEqual(["reopened", "old"]);
});

test("the sender is the initiator, whichever side of the pair they are", () => {
  const [fromRequester] = buildConnectionRequests([row({ initiated_by: A })]);
  expect(fromRequester).toMatchObject({ requesterId: A, requesterName: "Alice", requesterAvatarUrl: "a.png" });
  const [fromRecipient] = buildConnectionRequests([row({ initiated_by: B })]);
  expect(fromRecipient).toMatchObject({ requesterId: B, requesterName: "Bob", requesterAvatarUrl: "b.png" });
});

test("a missing profile leaves name and avatar null", () => {
  const [req] = buildConnectionRequests([row({ requester: null })]);
  expect(req).toMatchObject({ requesterName: null, requesterAvatarUrl: null });
});
