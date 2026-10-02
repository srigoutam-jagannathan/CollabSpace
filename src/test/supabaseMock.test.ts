import { db, has, rejectWith, supabase } from "./supabaseMock";

beforeEach(() => db.reset());

test("records the table, operation and filters of each awaited chain", async () => {
  await supabase.from("projects").select("id, title").eq("owner_id", "u1").limit(5);
  expect(db.calls).toHaveLength(1);
  const [call] = db.calls;
  expect(call).toMatchObject({ table: "projects", op: "select", columns: "id, title", single: false });
  expect(has(call, "eq", "owner_id", "u1")).toBe(true);
  expect(has(call, "limit", 5)).toBe(true);
  expect(has(call, "eq", "owner_id", "someone-else")).toBe(false);
});

test("answers with the resolver's result, defaulting the rest to null", async () => {
  db.respond((c) => (c.table === "projects" ? { data: [{ id: "p1" }] } : undefined));
  expect(await supabase.from("projects").select("id")).toEqual({ data: [{ id: "p1" }], error: null, count: null });
  expect(await supabase.from("profiles").select("id")).toEqual({ data: null, error: null, count: null });
});

test("records writes with their payload and any returning columns", async () => {
  await supabase.from("project_members").delete().eq("user_id", "u2").select("id");
  await supabase.from("chat_messages").insert({ content: "hi" });
  expect(db.calls[0]).toMatchObject({ table: "project_members", op: "delete", columns: "id" });
  expect(db.calls[1]).toMatchObject({ table: "chat_messages", op: "insert", payload: { content: "hi" } });
});

test("single() and maybeSingle() both mark a single-row read", async () => {
  await supabase.from("profiles").select("*").eq("id", "u1").single();
  await supabase.from("profiles").select("*").eq("id", "u1").maybeSingle();
  expect(db.calls.map((c) => c.single)).toEqual([true, true]);
});

test("array arguments compare by value", async () => {
  await supabase.from("collaboration_events").select("*").in("project_id", ["p1", "p2"]);
  expect(has(db.calls[0], "in", "project_id", ["p1", "p2"])).toBe(true);
});

test("a resolver that throws answers with an error, like postgrest-js on a network failure", async () => {
  db.respond(() => {
    throw new TypeError("offline");
  });
  const result = await supabase.from("projects").select("id");
  expect(result.data).toBeNull();
  expect(result.error).toMatchObject({ message: "TypeError: offline", code: "" });
});

test("strict mode rejects a query nothing answered, naming it", async () => {
  db.strict();
  db.respond((c) => (c.table === "projects" ? { data: [] } : undefined));
  await expect(supabase.from("projects").select("id")).resolves.toMatchObject({ data: [] });
  await expect(Promise.resolve(supabase.from("profiles").select("id").eq("id", "u1"))).rejects.toThrow(
    /Unanswered query: select profiles .*"eq","id","u1"/
  );
});

test("a strict rejection that the code catches is still recorded in db.unanswered", async () => {
  db.strict();
  await Promise.resolve(supabase.from("profiles").select("id")).catch(() => undefined);
  expect(db.unanswered).toHaveLength(1);
  expect(db.unanswered[0]).toMatch(/Unanswered query: select profiles/);
  db.reset();
  expect(db.unanswered).toEqual([]);
});

test("rejectWith makes the query reject with that error", async () => {
  const boom = new Error("boom");
  db.respond(() => rejectWith(boom));
  await expect(Promise.resolve(supabase.from("t").select("*"))).rejects.toBe(boom);
});

test("reset leaves strict mode", async () => {
  db.strict();
  db.reset();
  await expect(supabase.from("profiles").select("id")).resolves.toMatchObject({ data: null, error: null });
});

describe("single() and maybeSingle() over array data", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

  test("single() unwraps exactly one row", async () => {
    db.respond(() => ({ data: rows(1) }));
    expect(await supabase.from("t").select("*").single()).toMatchObject({ data: { id: "r0" }, error: null });
  });

  test("single() over zero rows is PGRST116", async () => {
    db.respond(() => ({ data: rows(0) }));
    expect(await supabase.from("t").select("*").single()).toMatchObject({ data: null, error: { code: "PGRST116" } });
  });

  test("single() over two rows is PGRST116", async () => {
    db.respond(() => ({ data: rows(2) }));
    expect(await supabase.from("t").select("*").single()).toMatchObject({ data: null, error: { code: "PGRST116" } });
  });

  test("maybeSingle() over zero rows is null without an error", async () => {
    db.respond(() => ({ data: rows(0) }));
    expect(await supabase.from("t").select("*").maybeSingle()).toEqual({ data: null, error: null, count: null });
  });

  test("maybeSingle() unwraps one row", async () => {
    db.respond(() => ({ data: rows(1) }));
    expect(await supabase.from("t").select("*").maybeSingle()).toMatchObject({ data: { id: "r0" } });
  });

  test("maybeSingle() over two rows is PGRST116", async () => {
    db.respond(() => ({ data: rows(2) }));
    expect(await supabase.from("t").select("*").maybeSingle()).toMatchObject({ data: null, error: { code: "PGRST116" } });
  });

  test("non-array data passes through as before", async () => {
    db.respond(() => ({ data: { id: "p1" } }));
    expect(await supabase.from("t").select("*").single()).toMatchObject({ data: { id: "p1" }, error: null });
  });

  test("the call records which one was used", async () => {
    await supabase.from("t").select("*").single();
    await supabase.from("t").select("*").maybeSingle();
    expect(db.calls.map((c) => [c.single, c.maybe])).toEqual([[true, false], [true, true]]);
  });
});

test("rpc and auth.updateUser exist with quiet defaults", async () => {
  expect(await supabase.rpc("anything", {})).toEqual({ data: null, error: null });
  expect(await supabase.auth.updateUser({ password: "x" })).toEqual({ data: { user: null }, error: null });
});

test("reset clears recorded calls and the resolver", async () => {
  db.respond(() => ({ data: 1 }));
  await supabase.from("projects").select("id");
  db.reset();
  expect(db.calls).toHaveLength(0);
  expect(await supabase.from("projects").select("id")).toMatchObject({ data: null });
});

test("auth defaults to signed out", async () => {
  expect(await supabase.auth.getSession()).toEqual({ data: { session: null }, error: null });
});

test("callsTo filters by table", async () => {
  await supabase.from("a").select("*");
  await supabase.from("b").select("*");
  await supabase.from("a").insert({});
  expect(db.callsTo("a").map((c) => c.op)).toEqual(["select", "insert"]);
});
