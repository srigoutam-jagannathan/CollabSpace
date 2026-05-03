import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Send, Check, Info } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import type { ChatMessage, Project, ProjectMember, Profile } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageWithSender = ChatMessage & {
  sender: Pick<Profile, "id" | "full_name" | "university" | "avatar_url">;
};

// ─── Member Info ──────────────────────────────────────────────────────────────

type MemberInfo = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  mouAccepted: boolean;
  isOwner: boolean;
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showSenderInfo,
}: {
  message: MessageWithSender;
  isOwn: boolean;
  showSenderInfo: boolean;
}) {
  const senderName = message.sender.full_name ?? "Anonymous";
  const initials = senderName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const isQUB = message.sender.university === "qub";

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 6, flexDirection: isOwn ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
      {/* Avatar column — only for others */}
      {!isOwn && (
        <View style={{ width: 28, alignItems: "center", justifyContent: "flex-end" }}>
          {showSenderInfo ? (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isQUB ? "#8B0000" : "#006E6D", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {message.sender.avatar_url ? (
                <Image source={{ uri: message.sender.avatar_url }} style={{ width: 28, height: 28 }} />
              ) : (
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{initials}</Text>
              )}
            </View>
          ) : (
            /* Spacer so bubble aligns when avatar is hidden */
            <View style={{ width: 28 }} />
          )}
        </View>
      )}

      {/* Bubble + name + timestamp */}
      <View style={{ maxWidth: "75%", alignItems: isOwn ? "flex-end" : "flex-start" }}>
        {!isOwn && showSenderInfo && (
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 3, marginLeft: 4 }}>
            {senderName}
          </Text>
        )}
        <View style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderBottomRightRadius: isOwn ? 4 : 20,
          borderBottomLeftRadius: isOwn ? 20 : 4,
          backgroundColor: isOwn ? "#7c3aed" : "#1e1040",
          borderWidth: isOwn ? 0 : 1,
          borderColor: "#2d1b69",
        }}>
          <Text style={{ color: "#ffffff", fontSize: 14, lineHeight: 20 }}>
            {message.content}
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3, paddingHorizontal: 4 }}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

// ─── Handshake Chat ───────────────────────────────────────────────────────────

export default function HandshakeChat({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [membership, setMembership] = useState<ProjectMember | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const hasSigned = membership?.mou_accepted === true;

  // ── Initial data load ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!projectId || !user) return;

    const [projectRes, messagesRes, membershipRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("chat_messages")
        .select("*, sender:profiles!sender_id(id, full_name, university, avatar_url)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (projectRes.data) setProject(projectRes.data as Project);
    if (messagesRes.data) setMessages(messagesRes.data as MessageWithSender[]);
    if (membershipRes.data) setMembership(membershipRes.data as ProjectMember);

    setLoading(false);
  }, [projectId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Fetch sender profile for the incoming message
          const { data: senderData } = await supabase
            .from("profiles")
            .select("id, full_name, university, avatar_url")
            .eq("id", newMsg.sender_id)
            .single();

          const enriched: MessageWithSender = {
            ...newMsg,
            sender: senderData ?? { id: newMsg.sender_id, full_name: null, university: "qub", avatar_url: null },
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === enriched.id)) return prev;
            return [...prev, enriched];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !projectId || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    await supabase.from("chat_messages").insert({
      project_id: projectId,
      sender_id: user.id,
      content: text,
      read_by: [user.id],
    });

    setSending(false);
  };

  // ── Fetch group members ─────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    if (!project) return;
    setLoadingMembers(true);

    const [{ data: membersData }, { data: ownerData }] = await Promise.all([
      supabase
        .from("project_members")
        .select("user_id, role, mou_accepted, profile:profiles!user_id(full_name, avatar_url)")
        .eq("project_id", projectId),
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", project.owner_id)
        .single(),
    ]);

    const memberList: MemberInfo[] = [];

    // Owner first
    if (ownerData) {
      memberList.push({
        userId: ownerData.id,
        fullName: ownerData.full_name,
        avatarUrl: ownerData.avatar_url,
        role: "Owner",
        mouAccepted: true,
        isOwner: true,
      });
    }

    // Contributors (skip if same as owner to avoid duplicate)
    for (const m of (membersData ?? []) as any[]) {
      if (m.user_id === project.owner_id) continue;
      memberList.push({
        userId: m.user_id,
        fullName: m.profile?.full_name ?? null,
        avatarUrl: m.profile?.avatar_url ?? null,
        role: m.role ?? "Member",
        mouAccepted: m.mou_accepted ?? false,
        isOwner: false,
      });
    }

    setMembers(memberList);
    setLoadingMembers(false);
  }, [project, projectId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2d1b69" }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }} hitSlop={12}>
          <ChevronLeft size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => { fetchMembers(); setShowInfo(true); }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
            {project?.title ?? "Loading…"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Tap for group info</Text>
        </Pressable>

        <Pressable
          style={{ marginRight: 10 }}
          onPress={() =>
            router.push({ pathname: "/(app)/projects/[id]/insights", params: { id: projectId } })
          }
          hitSlop={12}
        >
          <Info size={20} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {hasSigned && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
            <Check size={13} color="#10b981" />
            <Text style={{ color: "#10b981", fontSize: 12, fontWeight: "600" }}>MOU Signed</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: "600", marginBottom: 6 }}>No messages yet</Text>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center" }}>
                Start the conversation — introduce yourself and your interest in this project.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => {
                const isOwn = item.sender_id === user?.id;
                const prevMsg = messages[index - 1];
                const showSenderInfo = !isOwn && (!prevMsg || prevMsg.sender_id !== item.sender_id);
                return <MessageBubble message={item} isOwn={isOwn} showSenderInfo={showSenderInfo} />;
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Input bar */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#2d1b69", backgroundColor: "#1e1040" }}>
            <TextInput
              style={{ flex: 1, backgroundColor: "transparent", borderWidth: 1, borderColor: "#2d1b69", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: "#ffffff", fontSize: 14 }}
              placeholder="Message…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <Pressable
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: inputText.trim() ? "#7c3aed" : "#2d1b69" }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={16} color={inputText.trim() ? "#fff" : "rgba(255,255,255,0.3)"} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Group info modal */}
      <Modal
        visible={showInfo}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setShowInfo(false)} />
        <View style={{
          backgroundColor: "#120030",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: "#2d1b69",
          maxHeight: "75%",
          paddingBottom: 32,
        }}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
          </View>

          {/* Project info */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#2d1b69" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18, marginBottom: 6 }} numberOfLines={2}>
              {project?.title}
            </Text>
            {project?.description ? (
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                {project.description}
              </Text>
            ) : null}
          </View>

          {/* Members header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Members · {members.length}
            </Text>
          </View>

          {loadingMembers ? (
            <ActivityIndicator size="small" color="#7c3aed" style={{ marginTop: 16 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {members.map((m) => {
                const name = m.fullName ?? "Unknown";
                const initials = name.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.isOwner ? "#6824CC" : "#2d1b69", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {m.avatarUrl ? (
                        <Image source={{ uri: m.avatarUrl }} style={{ width: 40, height: 40 }} />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{initials}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <Text style={{ color: m.isOwner ? "#9434D8" : "rgba(255,255,255,0.45)", fontSize: 12 }}>{m.role}</Text>
                        {!m.isOwner && (
                          <View style={{
                            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
                            backgroundColor: m.mouAccepted ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
                          }}>
                            <Text style={{ color: m.mouAccepted ? "#34D399" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "600" }}>
                              {m.mouAccepted ? "MOU Signed" : "Pending"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
