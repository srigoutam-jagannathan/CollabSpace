import { db, has, supabase } from "./supabaseMock";

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

test("a resolver that throws rejects the query, like a network failure", async () => {
  db.respond(() => {
    throw new Error("offline");
  });
  await expect(Promise.resolve(supabase.from("projects").select("id"))).rejects.toThrow("offline");
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
