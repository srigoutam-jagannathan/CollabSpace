import { assertEquals } from "jsr:@std/assert@1";
import { type MemberRow, pickHeir } from "./heir.ts";

const OWNER = "owner";

function row(user_id: string, status: string, created_at: string): MemberRow {
  return { user_id, status, created_at };
}

Deno.test("the earliest approved member inherits", () => {
  const rows = [
    row("later", "approved", "2026-09-03T00:00:00Z"),
    row("earlier", "approved", "2026-09-02T00:00:00Z"),
  ];
  assertEquals(pickHeir(rows, OWNER), "earlier");
});

Deno.test("a pending requester never inherits, even if earliest", () => {
  const rows = [
    row("requester", "pending", "2026-09-01T00:00:00Z"),
    row("member", "approved", "2026-09-05T00:00:00Z"),
  ];
  assertEquals(pickHeir(rows, OWNER), "member");
});

Deno.test("the departing owner's own row is skipped", () => {
  const rows = [
    row(OWNER, "approved", "2026-08-01T00:00:00Z"),
    row("member", "approved", "2026-09-05T00:00:00Z"),
  ];
  assertEquals(pickHeir(rows, OWNER), "member");
});

Deno.test("only pending requesters means no heir", () => {
  const rows = [row(OWNER, "approved", "2026-08-01T00:00:00Z"), row("r", "pending", "2026-09-01T00:00:00Z")];
  assertEquals(pickHeir(rows, OWNER), null);
  assertEquals(pickHeir([], OWNER), null);
});
