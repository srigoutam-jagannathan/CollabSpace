import { assertEquals } from "jsr:@std/assert@1";
import { notifyNewOwner, type TransferPushDeps } from "./transferPush.ts";

type Push = { to: string; title: string; body: string };

function fakeDeps(overrides: Partial<TransferPushDeps> = {}) {
  const pushes: Push[] = [];
  const deps: TransferPushDeps = {
    pushToken: (id) => Promise.resolve(id === "heir" ? "ExponentPushToken[heir]" : null),
    sendPush: (msg) => {
      pushes.push(msg);
      return Promise.resolve({});
    },
    ...overrides,
  };
  return { deps, pushes };
}

Deno.test("the new owner is pushed directly, with their own token", async () => {
  const { deps, pushes } = fakeDeps();
  assertEquals(await notifyNewOwner("heir", "Dara Quinn", deps), true);
  assertEquals(pushes, [{
    to: "ExponentPushToken[heir]",
    title: "You're now the project owner",
    body: "Dara Quinn deleted their account. You've inherited ownership.",
  }]);
});

Deno.test("a new owner with no token is skipped", async () => {
  const { deps, pushes } = fakeDeps();
  assertEquals(await notifyNewOwner("someone-else", "Dara Quinn", deps), false);
  assertEquals(pushes.length, 0);
});

Deno.test("a failed push never aborts the account deletion", async () => {
  const { deps } = fakeDeps({ sendPush: () => Promise.reject(new Error("expo down")) });
  assertEquals(await notifyNewOwner("heir", "Dara Quinn", deps), false);
  const { deps: d2 } = fakeDeps({ pushToken: () => Promise.reject(new Error("db down")) });
  assertEquals(await notifyNewOwner("heir", "Dara Quinn", d2), false);
});
