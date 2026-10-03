jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

import { db, supabase } from "@/test/supabaseMock";
import { requestConnection } from "./requestConnection";

beforeEach(() => db.reset());

test("sends the request through the request_connection RPC with the other person's id", async () => {
  const result = await requestConnection("u2");
  expect(supabase.rpc).toHaveBeenCalledWith("request_connection", { p_other: "u2" });
  expect(result).toEqual({ ok: true });
  // Never a direct insert: the insert policy is gone.
  expect(db.callsTo("connections")).toEqual([]);
});

test("within 7 days of a rejection (CS001), says when they can ask again", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "CS001", message: "you can ask again 7 days after a rejection" },
  });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "too_soon", message: "You can send a new request 7 days after it was declined",
  });
});

test("an existing request or connection (CS002) reads as already sent", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "CS002", message: "a request between you already exists" },
  });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "exists", message: "Request already sent",
  });
});

// The code decides, not the wording. Each code is paired with the other
// error's message, so matching on text, or swapping the codes, fails here.
test("CS001 is the 7-day wait, whatever the message says", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "CS001", message: "a request between you already exists" },
  });
  expect(await requestConnection("u2")).toMatchObject({ ok: false, reason: "too_soon" });
});

test("CS002 is already sent, whatever the message says", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "CS002", message: "you can ask again 7 days after a rejection" },
  });
  expect(await requestConnection("u2")).toMatchObject({ ok: false, reason: "exists" });
});

test("an invalid recipient (22023) is a generic retry", async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "not a valid recipient" } });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "failed", message: "Couldn't send the request. Try again.",
  });
});

test("any other failure is a generic retry", async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "network down" } });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "failed", message: "Couldn't send the request. Try again.",
  });
});

test("a thrown network error is a generic retry too", async () => {
  supabase.rpc.mockRejectedValue(new TypeError("Network request failed"));
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "failed", message: "Couldn't send the request. Try again.",
  });
});
