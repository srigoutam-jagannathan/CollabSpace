import { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { User, CheckCircle, MessageCircle, UserPlus, X, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JoinRequest = {
  eventId: string;
  projectId: string;
  projectTitle: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  actorDepartment: string | null;
  actorUniversity: string | null;
  actorSkills: string[];
  introMessage: string | null;
  role: string | null;
  createdAt: string;
  isApproved: boolean;
};

type MyApproval = {
  id: string;
  projectTitle: string;
  projectId: string;
  createdAt: string;
};

type ConnectionRequest = {
  id: string;
  requesterId: string;
  requesterName: string | null;   // null if profile missing
  requesterAvatarUrl: string | null;
  createdAt: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${diffWk}w ago`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Notifications Screen ──────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [myApprovals, setMyApprovals] = useState<MyApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // ── Section 1: join requests on owned projects ──────────────────────────

    const { data: ownedProjects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("owner_id", user.id);

    if (ownedProjects && ownedProjects.length > 0) {
      const ownedIds = ownedProjects.map((p: { id: string }) => p.id);
      const ownedMap = new Map<string, string>(
        ownedProjects.map((p: { id: string; title: string }) => [p.id, p.title])
      );

      const [{ data: events }, { data: members }] = await Promise.all([
        supabase
          .from("collaboration_events")
          .select(`id, created_at, project_id, user_id, actor:profiles!user_id(id, full_name, avatar_url, department, university, skills)`)
          .in("project_id", ownedIds)
          .eq("event_type", "join")
          .order("created_at", { ascending: false }),
        supabase
          .from("project_members")
          .select("project_id, user_id, intro_message, role, mou_accepted")
          .in("project_id", ownedIds),
      ]);

      const introMap = new Map<string, { intro: string | null; role: string | null; approved: boolean }>();
      (members ?? []).forEach((m: any) => {
        introMap.set(`${m.project_id}:${m.user_id}`, {
          intro: m.intro_message ?? null,
          role: m.role ?? null,
          approved: m.mou_accepted ?? false,
        });
      });

      const result: JoinRequest[] = (events as any[] ?? []).map((e) => {
        const actor = e.actor ?? {};
        const key = `${e.project_id}:${e.user_id}`;
        const memberData = introMap.get(key);
        return {
          eventId: e.id,
          projectId: e.project_id,
          projectTitle: ownedMap.get(e.project_id) ?? "Unknown Project",
          actorId: e.user_id,
          actorName: actor.full_name ?? "Unknown",
          actorAvatarUrl: actor.avatar_url ?? null,
          actorDepartment: actor.department ?? null,
          actorUniversity: actor.university ?? null,
          actorSkills: actor.skills ?? [],
          introMessage: memberData?.intro ?? null,
          role: memberData?.role ?? null,
          createdAt: e.created_at,
          isApproved: memberData?.approved ?? false,
        };
      });

      setRequests(result);
    } else {
      setRequests([]);
    }

    // ── Section 2: my own approval notifications ────────────────────────────

    const { data: approvalEvents } = await supabase
      .from("collaboration_events")
      .select("id, created_at, project_id, metadata")
      .eq("user_id", user.id)
      .eq("event_type", "mou_signed")
      .order("created_at", { ascending: false });

    const approvals: MyApproval[] = (approvalEvents ?? [])
      .filter((e: any) => e.metadata?.approved === true)
      .map((e: any) => ({
        id: e.id,
        projectTitle: e.metadata?.project_title ?? "A project",
        projectId: e.project_id,
        createdAt: e.created_at,
      }));

    setMyApprovals(approvals);

    // ── Section 3: incoming connection requests ─────────────────────────────
    const { data: connReqs } = await supabase
      .from("connections")
      .select("id, requester_id, recipient_id, initiated_by, created_at, requester:profiles!requester_id(full_name, avatar_url), recipient:profiles!recipient_id(full_name, avatar_url)")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .neq("initiated_by", user.id)   // only incoming — not ones I sent
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const parsedConnReqs: ConnectionRequest[] = (connReqs ?? []).map((c: any) => {
      // The initiator's profile (the person who sent the request)
      const isInitiatorRequester = c.initiated_by === c.requester_id;
      const initiatorProfile = isInitiatorRequester ? c.requester : c.recipient;
      return {
        id: c.id,
        requesterId: c.initiated_by,
        requesterName: initiatorProfile?.full_name ?? null,
        requesterAvatarUrl: initiatorProfile?.avatar_url ?? null,
        createdAt: c.created_at,
      };
    });
    setConnectionRequests(parsedConnReqs);

    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  async function handleApprove(req: JoinRequest) {
    setApprovingId(req.eventId);

    const { error: updateErr } = await supabase
      .from("project_members")
      .update({ mou_accepted: true, mou_accepted_at: new Date().toISOString() })
      .eq("project_id", req.projectId)
      .eq("user_id", req.actorId);

    if (updateErr) {
      Alert.alert("Error", updateErr.message);
      setApprovingId(null);
      return;
    }

    // Insert approval notification event for the joiner
    await supabase.from("collaboration_events").insert({
      project_id: req.projectId,
      user_id: req.actorId,
      event_type: "mou_signed",
      metadata: { approved: true, project_title: req.projectTitle },
    });

    // Update local state — mark as approved
    setRequests((prev) =>
      prev.map((r) => r.eventId === req.eventId ? { ...r, isApproved: true } : r)
    );
    setApprovingId(null);
  }

  async function handleConnectionResponse(connId: string, accept: boolean) {
    setRespondingId(connId);
    try {
      const { error } = await supabase
        .from("connections")
        .update({ status: accept ? "accepted" : "rejected" })
        .eq("id", connId);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setConnectionRequests((prev) => prev.filter((c) => c.id !== connId));
    } finally {
      setRespondingId(null);
    }
  }

  function toggleExpand(eventId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  const hasContent = requests.length > 0 || myApprovals.length > 0 || connectionRequests.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(20) }}>
        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(26) }}>
          Notifications
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      ) : !hasContent ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <User size={s(40)} color={C.textFaint} strokeWidth={1.5} />
          <Text style={{ color: C.textMuted, fontFamily: FONT.medium, fontSize: fs(15), marginTop: vs(12) }}>
            No notifications yet
          </Text>
          <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(6) }}>
            Join requests will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: vs(40) }} showsVerticalScrollIndicator={false}>

          {/* ── Connection Requests ───────────────────────────────────────── */}
          {connectionRequests.length > 0 && (
            <View style={{ marginBottom: vs(12) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(7), paddingHorizontal: s(20), marginBottom: vs(10) }}>
                <UserPlus size={s(13)} color={C.purpleL} strokeWidth={2} />
                <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), textTransform: "uppercase", letterSpacing: 0.7 }}>
                  Connection Requests
                </Text>
                <View style={{ marginLeft: s(4), backgroundColor: C.purple, borderRadius: s(10), paddingHorizontal: s(7), paddingVertical: vs(1) }}>
                  <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(11) }}>{connectionRequests.length}</Text>
                </View>
              </View>
              {connectionRequests.map((conn) => {
                const displayName = conn.requesterName ?? "Unknown User";
                const initials = getInitials(displayName);
                const isResponding = respondingId === conn.id;
                const isUnknown = conn.requesterName === null;
                return (
                  <View
                    key={conn.id}
                    style={{
                      marginHorizontal: s(20),
                      marginBottom: vs(10),
                      borderRadius: s(18),
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(168,85,247,0.22)",
                    }}
                  >
                    {/* Accent top stripe */}
                    <View style={{ height: vs(3), backgroundColor: C.purple, opacity: 0.7 }} />

                    <View style={{
                      backgroundColor: "rgba(45,12,100,0.72)",
                      padding: s(16),
                      paddingTop: s(14),
                    }}>
                      {/* Top row: avatar + info + time */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: s(13) }}>
                        {/* Avatar with ring */}
                        <View style={{
                          width: s(50), height: s(50), borderRadius: s(25),
                          backgroundColor: "rgba(104,36,204,0.35)",
                          borderWidth: 2, borderColor: "rgba(168,85,247,0.5)",
                          alignItems: "center", justifyContent: "center",
                          overflow: "hidden",
                        }}>
                          {conn.requesterAvatarUrl ? (
                            <Image source={{ uri: conn.requesterAvatarUrl }} style={{ width: s(50), height: s(50) }} />
                          ) : (
                            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16) }}>{initials}</Text>
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15), letterSpacing: -0.2 }}>
                            {displayName}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: s(4), marginTop: vs(3) }}>
                            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: C.purpleL, opacity: 0.8 }} />
                            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
                              wants to connect
                            </Text>
                          </View>
                        </View>

                        <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11) }}>
                          {formatRelativeTime(conn.createdAt)}
                        </Text>
                      </View>

                      {/* Action buttons row */}
                      <View style={{ flexDirection: "row", gap: s(10), marginTop: vs(14) }}>
                        {!isUnknown && (
                          <Btn
                            onPress={() => handleConnectionResponse(conn.id, true)}
                            pressScale={0.93}
                            disabled={isResponding}
                            style={{ flex: 1 }}
                          >
                            <View style={{
                              flexDirection: "row", alignItems: "center", justifyContent: "center",
                              gap: s(6), backgroundColor: C.success, borderRadius: s(12),
                              paddingVertical: vs(10),
                            }}>
                              {isResponding ? (
                                <ActivityIndicator size="small" color="#0a1a10" style={{ width: s(16) }} />
                              ) : (
                                <>
                                  <Check size={s(14)} color="#0a1a10" strokeWidth={2.5} />
                                  <Text style={{ color: "#0a1a10", fontFamily: FONT.bold, fontSize: fs(13) }}>Accept</Text>
                                </>
                              )}
                            </View>
                          </Btn>
                        )}
                        <Btn
                          onPress={() => handleConnectionResponse(conn.id, false)}
                          pressScale={0.93}
                          disabled={isResponding}
                          style={isUnknown ? { flex: 1 } : undefined}
                        >
                          <View style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "center",
                            gap: s(6), borderWidth: 1, borderColor: "rgba(248,113,113,0.4)",
                            borderRadius: s(12), paddingVertical: vs(10), paddingHorizontal: s(18),
                            backgroundColor: "rgba(248,113,113,0.08)",
                          }}>
                            <X size={s(13)} color={C.danger} strokeWidth={2.5} />
                            <Text style={{ color: C.danger, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
                              {isResponding && isUnknown ? "..." : "Decline"}
                            </Text>
                          </View>
                        </Btn>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── My Approvals ──────────────────────────────────────────────── */}
          {myApprovals.length > 0 && (
            <View style={{ marginBottom: vs(8) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), paddingHorizontal: s(20), marginBottom: vs(8), textTransform: "uppercase", letterSpacing: 0.6 }}>
                My Updates
              </Text>
              {myApprovals.map((approval) => (
                <View
                  key={approval.id}
                  style={{
                    backgroundColor: "rgba(60,140,80,0.15)",
                    borderRadius: s(16),
                    marginHorizontal: s(20),
                    marginBottom: vs(10),
                    padding: s(16),
                    borderWidth: 1,
                    borderColor: "rgba(52,211,153,0.25)",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: s(12),
                  }}
                >
                  <View style={{ marginTop: vs(2) }}>
                    <CheckCircle size={s(20)} color={C.success} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14) }}>
                      You've been approved!
                    </Text>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(3) }}>
                      Your request to join <Text style={{ color: C.white, fontFamily: FONT.semiBold }}>{approval.projectTitle}</Text> was accepted.
                    </Text>
                    <Btn
                      onPress={() => router.push({ pathname: "/(app)/chat/[id]", params: { id: approval.projectId } })}
                      pressScale={0.93}
                      style={{ marginTop: vs(10), alignSelf: "flex-start" }}
                    >
                      <View style={{
                        flexDirection: "row", alignItems: "center", gap: s(6),
                        backgroundColor: C.purple, borderRadius: s(14),
                        paddingHorizontal: s(14), paddingVertical: vs(7),
                      }}>
                        <MessageCircle size={s(14)} color={C.white} strokeWidth={2} />
                        <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(12) }}>
                          Connect via Chat
                        </Text>
                      </View>
                    </Btn>
                    <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11), marginTop: vs(8) }}>
                      {formatRelativeTime(approval.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Join Requests ─────────────────────────────────────────────── */}
          {requests.length > 0 && (
            <View>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), paddingHorizontal: s(20), marginBottom: vs(8), textTransform: "uppercase", letterSpacing: 0.6 }}>
                Join Requests
              </Text>
              {requests.map((req) => {
                const initials = getInitials(req.actorName);
                const isExpanded = expandedIds.has(req.eventId);
                const isApproving = approvingId === req.eventId;

                return (
                  <View
                    key={req.eventId}
                    style={{
                      backgroundColor: req.isApproved ? "rgba(30,8,72,0.5)" : C.surface,
                      borderRadius: s(16),
                      marginHorizontal: s(20),
                      marginBottom: vs(12),
                      padding: s(16),
                      borderWidth: 1,
                      borderColor: req.isApproved ? "rgba(52,211,153,0.2)" : C.border,
                    }}
                  >
                    {/* Top row */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Btn
                        onPress={() => router.push({ pathname: "/(app)/users/[id]", params: { id: req.actorId } })}
                        pressScale={0.92}
                      >
                        <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: C.purple, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {req.actorAvatarUrl ? (
                            <Image source={{ uri: req.actorAvatarUrl }} style={{ width: s(44), height: s(44) }} />
                          ) : (
                            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15) }}>{initials}</Text>
                          )}
                        </View>
                      </Btn>

                      {req.isApproved ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(5) }}>
                          <CheckCircle size={s(14)} color={C.success} strokeWidth={2} />
                          <Text style={{ color: C.success, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Approved</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", gap: s(8) }}>
                          <Btn
                            onPress={() => router.push(`/(app)/users/${req.actorId}` as any)}
                            pressScale={0.92}
                          >
                            <View style={{ borderWidth: 1, borderColor: C.pink, borderRadius: s(14), paddingHorizontal: s(12), paddingVertical: vs(6) }}>
                              <Text style={{ color: C.pink, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Profile</Text>
                            </View>
                          </Btn>

                          <Btn
                            onPress={() => handleApprove(req)}
                            pressScale={0.92}
                            disabled={isApproving}
                          >
                            <View style={{ backgroundColor: C.success, borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), opacity: isApproving ? 0.6 : 1 }}>
                              {isApproving ? (
                                <ActivityIndicator size="small" color={C.white} style={{ width: s(40) }} />
                              ) : (
                                <Text style={{ color: "#0a1a10", fontFamily: FONT.bold, fontSize: fs(12) }}>Approve</Text>
                              )}
                            </View>
                          </Btn>
                        </View>
                      )}
                    </View>

                    {/* Name + project */}
                    <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15), marginTop: vs(10) }}>
                      {req.actorName}
                    </Text>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(2) }}>
                      wants to join <Text style={{ color: C.purpleL }}>{req.projectTitle}</Text>
                    </Text>

                    {/* Role pill */}
                    {req.role ? (
                      <View style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: C.border, borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: vs(3), marginTop: vs(8) }}>
                        <Text style={{ color: C.purpleL, fontFamily: FONT.medium, fontSize: fs(12) }}>{req.role}</Text>
                      </View>
                    ) : null}

                    {/* Intro message */}
                    {req.introMessage ? (
                      <View style={{ marginTop: vs(10) }}>
                        <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), marginBottom: vs(4) }}>
                          Intro:
                        </Text>
                        <Text
                          style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(13), lineHeight: vs(19) }}
                          numberOfLines={isExpanded ? undefined : 3}
                        >
                          {req.introMessage}
                        </Text>
                        {req.introMessage.length > 120 && (
                          <Btn onPress={() => toggleExpand(req.eventId)} pressScale={0.9} style={{ marginTop: vs(4) }}>
                            <Text style={{ color: C.purpleL, fontFamily: FONT.medium, fontSize: fs(12) }}>
                              {isExpanded ? "Show less" : "Show more"}
                            </Text>
                          </Btn>
                        )}
                      </View>
                    ) : null}

                    {/* Timestamp */}
                    <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11), marginTop: vs(10) }}>
                      {formatRelativeTime(req.createdAt)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
