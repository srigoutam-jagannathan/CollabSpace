import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handle } from "./handler.ts";

const OWNER = "owner-id";
const LEAVER = "leaver-id";
const PROJECT = "project-id";
const NOW = new Date("2026-10-04T12:00:00.000Z");

type Push = { to: string; title: string; body: string };

/** Deps for a leaver who just quit PROJECT; each test overrides what it needs. */
function fakeDeps(overrides: Partial<Deps> = {}) {
  const pushes: Push[] = [];
  const quitChecks: Array<[string, string, string]> = [];
  const deps: Deps = {
    userIdFromJwt: (h) => Promise.resolve(h === "Bearer good" ? LEAVER : null),
    recentQuit: (projectId, userId, since) => {
      quitChecks.push([projectId, userId, since]);
      return Promise.resolve(projectId === PROJECT && userId === LEAVER);
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

Deno.test("no recent member_quit by the caller is 403 and sends nothing", async () => {
  const { deps, pushes } = fakeDeps({ recentQuit: () => Promise.resolve(false) });
  const res = await handle("Bearer good", { projectId: PROJECT, title: "spam", body: "spam" }, deps);
  assertEquals(res.status, 403);
  assertEquals(pushes.length, 0);
});

Deno.test("the quit window is the last 10 minutes, for the caller on that project", async () => {
  const { deps, quitChecks } = fakeDeps();
  await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(quitChecks, [[PROJECT, LEAVER, "2026-10-04T11:50:00.000Z"]]);
});

Deno.test("an unknown project is 404", async () => {
  const { deps, pushes } = fakeDeps({ project: () => Promise.resolve(null) });
  const res = await handle("Bearer good", { projectId: PROJECT }, deps);
  assertEquals(res.status, 404);
  assertEquals(pushes.length, 0);
});

Deno.test("the owner as caller sends nothing", async () => {
  const { deps, pushes } = fakeDeps({ userIdFromJwt: () => Promise.resolve(OWNER) });
  // recentQuit fake only passes LEAVER; let the owner through to reach the self check.
  deps.recentQuit = () => Promise.resolve(true);
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
