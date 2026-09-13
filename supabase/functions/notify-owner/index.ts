import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPayload {
  ownerUserId?: string;
  projectId?: string;       // alternative: look up owner from project
  title: string;
  body: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: NotifyPayload = await req.json();
    let ownerUserId = payload.ownerUserId;

    // If ownerUserId not supplied directly, resolve from projectId
    if (!ownerUserId && payload.projectId) {
      const { data: project } = await admin
        .from("projects")
        .select("owner_id")
        .eq("id", payload.projectId)
        .single();
      ownerUserId = project?.owner_id;
    }

    if (!ownerUserId) {
      return new Response(JSON.stringify({ error: "Cannot resolve owner" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get owner's push token
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("expo_push_token")
      .eq("id", ownerUserId)
      .single();

    const token = ownerProfile?.expo_push_token;
    if (!token) {
      // Owner hasn't granted notifications — skip silently
      return new Response(JSON.stringify({ sent: false, reason: "no_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Expo Push API
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        sound: "default",
      }),
    });

    const expoData = await expoRes.json();

    return new Response(JSON.stringify({ sent: true, expo: expoData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-owner error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
