import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/push.ts";
import { notifyNewOwner, type TransferPushDeps } from "./transferPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Identify caller from JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const pushDeps: TransferPushDeps = {
      async pushToken(id) {
        const { data, error } = await admin
          .from("push_tokens")
          .select("token")
          .eq("user_id", id)
          .maybeSingle();
        if (error) throw error;
        return data?.token ?? null;
      },
      sendPush: (msg) => sendExpoPush(msg.to, msg.title, msg.body),
    };

    // ── Step 1: Grab the user's display name before we wipe it ────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const displayName = profile?.full_name ?? "A user";

    // ── Step 2: Project ownership transfers ───────────────────────────────────
    const { data: ownedProjects } = await admin
      .from("projects")
      .select("id")
      .eq("owner_id", userId);

    for (const project of ownedProjects ?? []) {
      const { data: firstMember } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", project.id)
        .neq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstMember) {
        // No other collaborators — delete the project (cascade handles the rest)
        await admin.from("projects").delete().eq("id", project.id);
      } else {
        // Transfer ownership to the earliest collaborator
        await admin
          .from("projects")
          .update({ owner_id: firstMember.user_id })
          .eq("id", project.id);

        await admin.from("collaboration_events").insert({
          project_id: project.id,
          user_id: firstMember.user_id,
          event_type: "milestone",
          metadata: {
            event: "ownership_transferred",
            previous_owner_name: displayName,
          },
        });

        // Notify the new owner via push (best effort; never throws)
        await notifyNewOwner(firstMember.user_id, displayName, pushDeps);
      }
    }

    // ── Step 3: Insert account-deleted pill in every project chat ─────────────
    // Collect all project IDs the user is involved in (as member or owner of surviving projects)
    const { data: memberRows } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    // Also include projects the user owned that weren't deleted (transferred ownership)
    const { data: survivingOwned } = await admin
      .from("projects")
      .select("id")
      .neq("owner_id", userId); // already transferred, so owner_id is no longer userId

    // Build the set of project IDs to drop the pill into
    const projectIds = new Set<string>();
    for (const row of memberRows ?? []) projectIds.add(row.project_id);

    // Re-query original owned projects that survived (transferred) — they still have the chat
    // We track these by re-checking projects that had ownership transferred
    const { data: transferredProjects } = await admin
      .from("collaboration_events")
      .select("project_id")
      .eq("event_type", "milestone")
      .contains("metadata", { event: "ownership_transferred", previous_owner_name: displayName });

    for (const row of transferredProjects ?? []) projectIds.add(row.project_id);

    const epitaphInserts = Array.from(projectIds).map((projectId) => ({
      project_id: projectId,
      sender_id: userId,
      type: "account_deleted",
      content: "",
      metadata: { userName: displayName },
      read_by: [],
    }));

    if (epitaphInserts.length > 0) {
      await admin.from("chat_messages").insert(epitaphInserts);
    }

    // ── Step 4: Wipe PII from profile ─────────────────────────────────────────
    await admin
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        display_name_at_deletion: displayName,
        full_name: null,
        avatar_url: null,
        bio: null,
        skills: [],
        badges: [],
        portfolio_links: [],
      })
      .eq("id", userId);

    const { error: pushTokenErr } = await admin.from("push_tokens").delete().eq("user_id", userId);
    if (pushTokenErr) throw pushTokenErr;

    // ── Step 5: Delete the auth user (invalidates all sessions) ───────────────
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
