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

test("within 7 days of a rejection, says when they can ask again", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "P0001", message: "you can ask again 7 days after a rejection" },
  });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "too_soon", message: "You can send a new request 7 days after it was declined",
  });
});

test("an existing request or connection reads as already sent", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { code: "P0001", message: "a request between you already exists" },
  });
  expect(await requestConnection("u2")).toEqual({
    ok: false, reason: "exists", message: "Request already sent",
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
