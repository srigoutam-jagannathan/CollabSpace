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
 */
export async function requestConnection(otherId: string): Promise<RequestConnectionResult> {
  let error: { message?: string } | null;
  try {
    ({ error } = await supabase.rpc("request_connection", { p_other: otherId }));
  } catch {
    return { ok: false, reason: "failed", message: "Couldn't send the request. Try again." };
  }
  if (!error) return { ok: true };

  const msg = error.message ?? "";
  if (msg.includes("7 days")) {
    return { ok: false, reason: "too_soon", message: "You can send a new request 7 days after it was declined" };
  }
  if (msg.includes("already exists")) {
    return { ok: false, reason: "exists", message: "Request already sent" };
  }
  return { ok: false, reason: "failed", message: "Couldn't send the request. Try again." };
}
