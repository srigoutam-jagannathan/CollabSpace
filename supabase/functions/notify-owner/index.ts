import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/push.ts";
import { type Deps, handle } from "./handler.ts";

// Wiring only: every rule lives in handler.ts, which handler.test.ts covers.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const deps: Deps = {
      async userIdFromJwt(authHeader) {
        const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return null;
        const { data, error } = await admin.auth.getUser(token);
        return error ? null : data.user?.id ?? null;
      },
      async recentQuit(projectId, userId, sinceIso) {
        const { data, error } = await admin
          .from("collaboration_events")
          .select("id")
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .eq("event_type", "member_quit")
          .gte("created_at", sinceIso)
          .limit(1);
        if (error) throw error;
        return (data?.length ?? 0) > 0;
      },
      async project(projectId) {
        const { data, error } = await admin
          .from("projects")
          .select("owner_id, title")
          .eq("id", projectId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      async displayName(userId) {
        const { data, error } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        return data?.full_name?.trim() || null;
      },
      async pushToken(userId) {
        const { data, error } = await admin
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return data?.token ?? null;
      },
      sendPush: (msg) => sendExpoPush(msg.to, msg.title, msg.body),
      now: () => new Date(),
    };

    let input: unknown = null;
    try {
      input = await req.json();
    } catch {
      // A missing or malformed body is a 400 from the handler, not a 500.
    }

    const result = await handle(req.headers.get("Authorization"), input, deps);
    return json(result.status, result.body);
  } catch (err) {
    console.error("notify-owner error:", err);
    return json(500, { error: "internal" });
  }
});
