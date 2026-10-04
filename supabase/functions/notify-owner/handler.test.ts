import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handle } from "./handler.ts";

const OWNER = "owner-id";
const LEAVER = "leaver-id";
const PROJECT = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b";
const NOW = new Date("2026-10-04T12:00:00.000Z");

type Push = { to: string; title: string; body: string };

/** Deps for a leaver who just quit PROJECT; each test overrides what it needs. */
function fakeDeps(overrides: Partial<Deps> = {}) {
  const pushes: Push[] = [];
  const quitChecks: Array<[string, string, string]> = [];
  // LEAVER has one unclaimed member_quit on PROJECT; a claim uses it up.
  let unclaimed = 1;
  const deps: Deps = {
    userIdFromJwt: (h) => Promise.resolve(h === "Bearer good" ? LEAVER : null),
    claimQuit: (projectId, userId, since) => {
      quitChecks.push([projectId, userId, since]);
      if (projectId !== PROJECT || userId !== LEAVER || unclaimed === 0) return Promise.resolve(false);
      unclaimed--;
      return Promise.resolve(true);
    },
    project: (id) =>
      Promise.resolve(id === PROJECT ? { owner_id: OWNER, title: "Lumen" } : null),
    displayName: (id) => Promise.resolve(id === LEAVER ? "Aoife Byrne" : null),
    pushToken: (id) => Promise.resolve(id === OWNER ? "ExponentPushToken[owner]" : null),
    sendPush: (msg) => {
      pushes.push(msg);
      return Promise.resolve({ ok: true });
    },
    now: () => NOW,
    ...overrides,
  };
  return { deps, pushes, quitChecks };
}

Deno.test("no JWT is 401 and sends nothing", async () => {
  const { deps, pushes } = fakeDeps();
  const res = await handle(null, { projectId: PROJECT }, deps);
  assertEquals(res.status, 401);
  assertEquals(pushes.length, 0);
});

Deno.test("an invalid JWT is 401 and sends nothing", async () => {
  const { deps, pushes } = fakeDeps();
  const res = await handle("Bearer forged", { projectId: PROJECT }, deps);
  assertEquals(res.status, 401);
  assertEquals(pushes.length, 0);
});

Deno.test("a missing projectId is 400", async () => {
  const { deps, pushes } = fakeDeps();
  assertEquals((await handle("Bearer good", {}, deps)).status, 400);
  assertEquals((await handle("Bearer good", null, deps)).status, 400);
  assertEquals((await handle("Bearer good", { projectId: 42 }, deps)).status, 400);
  assertEquals(pushes.length, 0);
});

Deno.test("a projectId that isn't a UUID is 400 and sends nothing", async () => {
  const { deps, pushes, quitChecks } = fakeDeps();
  const res = await handle("Bearer good", { projectId: "not-a-uuid" }, deps);
  assertEquals(res.status, 400);
  assertEquals(quitChecks.length, 0);
  assertEquals(pushes.length, 0);
});

Deno.test("no unclaimed recent member_quit by the caller is 403 and sends nothing", async () => {
  const { deps, pushes } = fakeDeps({ claimQuit: () => Promise.resolve(false) });
  const res = await handle("Bearer good", { projectId: PROJECT, title: "spam", body: "spam" }, deps);
  assertEquals(res.status, 403);
  assertEquals(pushes.length, 0);
});

Deno.test("the claim window is the last 10 minutes, for the caller on that project", async () => {
  const { deps, quitChecks } = fakeDeps();
  await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(quitChecks, [[PROJECT, LEAVER, "2026-10-04T11:50:00.000Z"]]);
});

Deno.test("one push per quit: a second call for the same quit is 403 and sends nothing", async () => {
  const { deps, pushes } = fakeDeps();
  assertEquals((await handle("Bearer good", { projectId: PROJECT }, deps)).status, 200);
  const again = await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(again.status, 403);
  assertEquals(again.body, { error: "nothing to notify" });
  assertEquals(pushes.length, 1);
});

Deno.test("the claim comes before any lookup or push", async () => {
  const calls: string[] = [];
  const { deps } = fakeDeps({
    claimQuit: () => (calls.push("claim"), Promise.resolve(false)),
    project: () => (calls.push("project"), Promise.resolve(null)),
    pushToken: () => (calls.push("token"), Promise.resolve(null)),
  });
  await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(calls, ["claim"]);
});

Deno.test("an unknown project is 404", async () => {
  const { deps, pushes } = fakeDeps({ project: () => Promise.resolve(null) });
  const res = await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(res.status, 404);
  assertEquals(pushes.length, 0);
});

Deno.test("the owner as caller sends nothing", async () => {
  const { deps, pushes } = fakeDeps({ userIdFromJwt: () => Promise.resolve(OWNER) });
  // The claimQuit fake only passes LEAVER; let the owner through to reach the self check.
  deps.claimQuit = () => Promise.resolve(true);
  const res = await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(res.status, 200);
  assertEquals(res.body, { sent: false, reason: "self" });
  assertEquals(pushes.length, 0);
});

Deno.test("an owner with no push token is sent: false", async () => {
  const { deps, pushes } = fakeDeps({ pushToken: () => Promise.resolve(null) });
  const res = await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(res.status, 200);
  assertEquals(res.body, { sent: false, reason: "no_token" });
  assertEquals(pushes.length, 0);
});

Deno.test("happy path: one push to the owner, text from the database, caller text ignored", async () => {
  const { deps, pushes } = fakeDeps();
  const res = await handle(
    "Bearer good",
    { projectId: PROJECT, ownerUserId: "someone-else", title: "Click here", body: "evil.example" },
    deps,
  );
  assertEquals(res.status, 200);
  assertEquals(res.body, { sent: true });
  assertEquals(pushes, [{
    to: "ExponentPushToken[owner]",
    title: "Aoife Byrne left Lumen",
    body: "Aoife Byrne has left the project.",
  }]);
});

Deno.test("a leaver with no name is 'A member'", async () => {
  const { deps, pushes } = fakeDeps({ displayName: () => Promise.resolve(null) });
  await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(pushes[0].title, "A member left Lumen");
  assertEquals(pushes[0].body, "A member has left the project.");
});
