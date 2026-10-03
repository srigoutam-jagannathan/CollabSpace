import { supabase } from "@/lib/supabaseClient";

export type RequestConnectionResult =
  | { ok: true }
  | { ok: false; reason: "too_soon" | "exists" | "failed"; message: string };

/**
 * Sends a connection request to `otherId` as the signed-in user.
 *
 * Requests go only through the request_connection RPC: it stores the pair
 * low-high, records the caller as the asker, and reopens a rejected row once
 * 7 days have passed (answers are final, so there is no direct insert).
 * Its errors are told apart by code (migration 20261003100360):
 * CS001 = within 7 days of a rejection, CS002 = already exists.
 */
export async function requestConnection(otherId: string): Promise<RequestConnectionResult> {
  let error: { code?: string } | null;
  try {
    ({ error } = await supabase.rpc("request_connection", { p_other: otherId }));
  } catch {
    return { ok: false, reason: "failed", message: "Couldn't send the request. Try again." };
  }
  if (!error) return { ok: true };

  if (error.code === "CS001") {
    return { ok: false, reason: "too_soon", message: "You can send a new request 7 days after it was declined" };
  }
  if (error.code === "CS002") {
    return { ok: false, reason: "exists", message: "Request already sent" };
  }
  return { ok: false, reason: "failed", message: "Couldn't send the request. Try again." };
}
