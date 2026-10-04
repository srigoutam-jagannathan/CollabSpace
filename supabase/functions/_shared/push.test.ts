import { assertEquals } from "jsr:@std/assert@1";
import { sendExpoPush } from "./push.ts";

Deno.test("sendExpoPush POSTs one message to the Expo Push API", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return Promise.resolve(new Response(JSON.stringify({ data: { status: "ok" } })));
  };
  const res = await sendExpoPush("ExponentPushToken[x]", "Hello", "World", fakeFetch);
  assertEquals(res, { data: { status: "ok" } });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://exp.host/--/api/v2/push/send");
  assertEquals(calls[0].init.method, "POST");
  assertEquals(JSON.parse(calls[0].init.body as string), {
    to: "ExponentPushToken[x]", title: "Hello", body: "World", sound: "default",
  });
});
