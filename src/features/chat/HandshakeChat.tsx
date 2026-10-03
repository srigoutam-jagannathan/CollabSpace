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
import { ChevronLeft, Send, Check, Info, Camera, DoorOpen, UserX, UserMinus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabaseClient";
import { uploadJpeg } from "@/lib/uploadImage";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { ProfileCardMessage } from "@/components/ProfileCardMessage";
import { QuitProjectSheet } from "@/components/QuitProjectSheet";
import { Btn } from "@/components/Btn";
import type { ChatMessage, Project, ProjectMember, Profile, ProfileCardMetadata } from "@/types/database";
import { ScreenLoader } from "@/components/ScreenLoader";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageWithSender = ChatMessage & {
  sender: Pick<Profile, "id" | "full_name" | "university" | "avatar_url" | "deleted_at" | "display_name_at_deletion"> | null;
};

// ─── Member Info ──────────────────────────────────────────────────────────────

type MemberInfo = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  committed: boolean;
  isOwner: boolean;
};

// ─── System pill card (account_deleted / member_left / member_removed) ───────

const SYSTEM_MESSAGE_TYPES = ["account_deleted", "member_left", "member_removed"];

function SystemPillCard({ message }: { message: MessageWithSender }) {
  const { tokens: { C } } = useTheme();
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const userName = (message.metadata as Record<string, string> | null)?.userName ?? "A user";
  const label =
    message.type === "account_deleted" ? `${userName} left CollabSpace · ${time}`
    : message.type === "member_removed" ? `${userName} was removed from the project · ${time}`
    : `${userName} left the project · ${time}`;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginVertical: 10, gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.borderSubtle }} />
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: C.fieldBg,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
      }}>
        <View style={{
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: C.avatarBg,
          borderWidth: 1, borderColor: C.border,
          alignItems: "center", justifyContent: "center",
        }}>
          <UserX size={8} color={C.textMuted} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.2 }}>{label}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: C.borderSubtle }} />
    </View>
  );
}

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
  const { tokens: { C } } = useTheme();
  const isDeleted = !!message.sender?.deleted_at;
  const senderName = isDeleted
    ? `${message.sender?.display_name_at_deletion ?? "Deleted User"} (Deleted User)`
    : (message.sender?.full_name ?? "Anonymous");
  const rawName = message.sender?.full_name ?? message.sender?.display_name_at_deletion ?? "?";
  const initials = rawName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const bubble = (
    <View style={{ marginHorizontal: 16, marginBottom: 6, flexDirection: isOwn ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
      {/* Avatar column — only for others */}
      {!isOwn && (
        <View style={{ width: 28, alignItems: "center", justifyContent: "flex-end" }}>
          {showSenderInfo ? (
            isDeleted ? (
              <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.avatarBg, alignItems: "center", justifyContent: "center" }}>
                <UserX size={12} color={C.textMuted} strokeWidth={2} />
              </View>
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.avatarBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {message.sender?.avatar_url ? (
                  <Image source={{ uri: message.sender.avatar_url }} style={{ width: 28, height: 28 }} />
                ) : (
                  <Text style={{ color: C.white, fontSize: 10, fontWeight: "700" }}>{initials}</Text>
                )}
              </View>
            )
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      )}

      {/* Bubble + name + timestamp */}
      <View style={{ maxWidth: "75%", alignItems: isOwn ? "flex-end" : "flex-start" }}>
        {!isOwn && showSenderInfo && (
          <Text style={{ color: isDeleted ? C.textFaint : C.textFaint, fontSize: 11, marginBottom: 3, marginLeft: 4 }}>
            {senderName}
          </Text>
        )}
        <View style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderBottomRightRadius: isOwn ? 4 : 20,
          borderBottomLeftRadius: isOwn ? 20 : 4,
          backgroundColor: isOwn ? C.purple : (isDeleted ? "rgba(42,32,64,0.55)" : C.chatBubbleOther),
          borderWidth: isOwn ? 0 : 1,
          borderColor: isDeleted ? C.borderSubtle : C.borderSubtle,
        }}>
          <Text style={{ color: isDeleted ? C.textMuted : C.white, fontSize: 14, lineHeight: 20 }}>
            {message.content}
          </Text>
        </View>
        <Text style={{ color: isDeleted ? "rgba(100,90,120,0.45)" : C.textFaint, fontSize: 11, marginTop: 3, paddingHorizontal: 4 }}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );

  return isDeleted ? <View style={{ opacity: 0.58 }}>{bubble}</View> : bubble;
}

// ─── Handshake Chat ───────────────────────────────────────────────────────────

export default function HandshakeChat({ projectId }: { projectId: string }) {
  const { tokens: { C } } = useTheme();
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
  const [showQuitSheet, setShowQuitSheet] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const hasCommitted = membership?.mou_accepted === true;
  const isOwner = !!user && project?.owner_id === user.id;
  // Owners may have no project_members row, so membership alone is not enough.
  // A member row only lets you post once the owner has approved it.
  const canPost = isOwner || membership?.status === "approved";
  const awaitingApproval = !isOwner && membership?.status === "pending";

  // ── Initial data load ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!projectId || !user) return;

    const [projectRes, messagesRes, membershipRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("chat_messages")
        .select("*, sender:profiles!sender_id(id, full_name, university, avatar_url, deleted_at, display_name_at_deletion)")
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

          // Fetch sender profile for the incoming message (null sender_id = system message)
          let senderData = null;
          if (newMsg.sender_id) {
            const { data } = await supabase
              .from("profiles")
              .select("id, full_name, university, avatar_url, deleted_at, display_name_at_deletion")
              .eq("id", newMsg.sender_id)
              .single();
            senderData = data;
          }

          const enriched: MessageWithSender = {
            ...newMsg,
            sender: senderData ?? (newMsg.sender_id
              ? { id: newMsg.sender_id, full_name: null, university: "qub" as const, avatar_url: null, deleted_at: null, display_name_at_deletion: null }
              : null),
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
    if (!inputText.trim() || !user || !projectId || sending || !canPost) return;

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
        .eq("project_id", projectId)
        // Pending requesters aren't members yet; the owner sees them in Notifications.
        .eq("status", "approved"),
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
        committed: true,
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
        committed: m.mou_accepted ?? false,
        isOwner: false,
      });
    }

    setMembers(memberList);
    setLoadingMembers(false);
  }, [project, projectId]);

  // ── Chat icon upload ────────────────────────────────────────────────────────

  const handlePickIcon = async () => {
    if (!isOwner || !project) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingIcon(true);
    try {
      const iconUrl = await uploadJpeg("avatars", `project-icons/${project.id}.jpg`, result.assets[0].uri);

      await supabase.from("projects").update({ chat_icon_url: iconUrl }).eq("id", project.id);
      setProject((prev) => prev ? { ...prev, chat_icon_url: iconUrl } : prev);
    } catch (e: any) {
      Alert.alert("Upload Failed", e?.message ?? "Could not update the group icon.");
    } finally {
      setUploadingIcon(false);
    }
  };

  // ── Remove a member (owner only) ───────────────────────────────────────────

  const confirmRemoveMember = (member: MemberInfo) => {
    const name = member.fullName ?? "this member";
    Alert.alert(
      `Remove ${name}?`,
      `They will lose access to this chat and the project. They can ask to join again.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeMember(member) },
      ]
    );
  };

  const removeMember = async (member: MemberInfo) => {
    if (!isOwner || !projectId || member.isOwner) return;
    setRemovingId(member.userId);
    try {
      // One transaction, server-side: deletes the membership row, logs
      // member_removed against them and posts the member_removed chat message.
      const { error } = await supabase.rpc("remove_member", {
        p_project: projectId, p_user: member.userId,
      });
      if (error) throw error;

      setMembers((prev) => prev.filter((x) => x.userId !== member.userId));
    } catch {
      Alert.alert("Error", `Could not remove ${member.fullName ?? "this member"}. Please try again.`);
    } finally {
      setRemovingId(null);
    }
  };

  // ── Quit project ───────────────────────────────────────────────────────────

  const handleQuit = async () => {
    if (!user || !projectId || !project) return;
    try {
      // One transaction, server-side: deletes the membership row, logs
      // member_quit and posts the member_left chat message.
      const { error: leaveErr } = await supabase.rpc("leave_project", { p_project: projectId });
      if (leaveErr) throw leaveErr;

      // The function builds the recipient and the text from the database.
      await supabase.functions.invoke("notify-owner", { body: { projectId } });

      router.replace("/(app)/projects" as any);
    } catch {
      Alert.alert("Error", "Could not leave the project. Please try again.");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(14), paddingVertical: vs(10), borderBottomWidth: 1, borderBottomColor: C.borderSubtle }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: s(10) }} hitSlop={12}>
          <ChevronLeft size={s(22)} color={C.textMuted} />
        </Pressable>

        {/* Group icon — tappable by owner */}
        <Pressable
          onPress={isOwner ? handlePickIcon : undefined}
          style={{ marginRight: s(10), position: "relative" }}
          hitSlop={4}
        >
          <View style={{ width: s(38), height: s(38), borderRadius: s(19), backgroundColor: C.avatarBg, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
            {project?.chat_icon_url ? (
              <Image source={{ uri: project.chat_icon_url }} style={{ width: s(38), height: s(38) }} />
            ) : (
              <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(13) }}>
                {(project?.title ?? "?").slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          {isOwner && (
            <View style={{
              position: "absolute", bottom: -1, right: -1,
              width: s(16), height: s(16), borderRadius: s(8),
              backgroundColor: uploadingIcon ? C.fieldBg : C.purple,
              borderWidth: 1.5, borderColor: C.bgMid,
              alignItems: "center", justifyContent: "center",
            }}>
              {uploadingIcon
                ? <ActivityIndicator size="small" color={C.white} style={{ transform: [{ scale: 0.55 }] }} />
                : <Camera size={s(8)} color={C.white} strokeWidth={2.5} />}
            </View>
          )}
        </Pressable>

        <Pressable
          style={{ flex: 1 }}
          onPress={() => { fetchMembers(); setShowInfo(true); }}
        >
          <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(14) }} numberOfLines={1}>
            {project?.title ?? "Loading…"}
          </Text>
          <Text style={{ color: C.textMuted, fontSize: fs(11) }}>Tap for group info</Text>
        </Pressable>

        <Pressable
          style={{ marginRight: 10 }}
          onPress={() =>
            router.push({ pathname: "/(app)/chat/insights/[id]", params: { id: projectId } })
          }
          hitSlop={12}
        >
          <Info size={20} color={C.textMuted} />
        </Pressable>

        {hasCommitted && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
            <Check size={13} color="#10b981" />
            <Text style={{ color: "#10b981", fontSize: 12, fontWeight: "600" }}>Committed</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ScreenLoader />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
              <Text style={{ color: C.textMuted, fontSize: 15, fontWeight: "600", marginBottom: 6 }}>No messages yet</Text>
              <Text style={{ color: C.textFaint, fontSize: 13, textAlign: "center" }}>
                Start the conversation — introduce yourself and your interest in this project.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => {
                if (SYSTEM_MESSAGE_TYPES.includes(item.type ?? "")) {
                  return <SystemPillCard message={item} />;
                }
                const isOwn = item.sender_id === user?.id;
                const prevMsg = messages[index - 1];
                const prevIsRegular = prevMsg && !SYSTEM_MESSAGE_TYPES.includes(prevMsg.type ?? "");
                const showSenderInfo = !isOwn && (!prevIsRegular || prevMsg.sender_id !== item.sender_id);
                if (item.type === "profile_card" && item.metadata) {
                  const meta = item.metadata as unknown as ProfileCardMetadata;
                  return (
                    <View style={{ marginHorizontal: 16, marginBottom: 6, alignItems: isOwn ? "flex-end" : "flex-start" }}>
                      <ProfileCardMessage
                        metadata={meta}
                        onPress={() => router.push({ pathname: "/(app)/users/[id]", params: { id: meta.userId } })}
                      />
                    </View>
                  );
                }
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

          {/* Input bar — hidden until you are approved, and once you leave */}
          {canPost ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.borderSubtle, backgroundColor: C.inputBg }}>
              <TextInput
                style={{ flex: 1, backgroundColor: "transparent", borderWidth: 1, borderColor: C.borderSubtle, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: C.white, fontSize: 14 }}
                placeholder="Message…"
                placeholderTextColor={C.textFaint}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                returnKeyType="default"
              />
              <Pressable
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: inputText.trim() ? C.purple : C.borderSubtle }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Send size={16} color={inputText.trim() ? C.white : C.textFaint} />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.borderSubtle, backgroundColor: C.inputBg }}>
              <Text style={{ color: C.textFaint, fontSize: fs(13), textAlign: "center" }}>
                {awaitingApproval
                  ? "Waiting for the owner to approve you"
                  : "You left this project. Rejoin to send messages."}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Quit project sheet */}
      <QuitProjectSheet
        visible={showQuitSheet}
        projectTitle={project?.title ?? ""}
        onClose={() => setShowQuitSheet(false)}
        onQuit={handleQuit}
      />

      {/* Group info modal */}
      <Modal
        visible={showInfo}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setShowInfo(false)} />
        <View style={{
          backgroundColor: C.modalBg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: C.borderSubtle,
          maxHeight: "75%",
          paddingBottom: 32,
        }}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.surface }} />
          </View>

          {/* Project info */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.borderSubtle }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 18, marginBottom: 6 }} numberOfLines={2}>
              {project?.title}
            </Text>
            {project?.description ? (
              <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                {project.description}
              </Text>
            ) : null}
          </View>

          {/* Members header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Members · {members.length}
            </Text>
          </View>

          {loadingMembers ? (
            <ActivityIndicator size="small" color={C.purple} style={{ marginTop: 16 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
              {members.map((m) => {
                const name = m.fullName ?? "Unknown";
                const initials = name.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.isOwner ? C.purple : C.avatarBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {m.avatarUrl ? (
                        <Image source={{ uri: m.avatarUrl }} style={{ width: 40, height: 40 }} />
                      ) : (
                        <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>{initials}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.white, fontWeight: "600", fontSize: 14 }}>{name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <Text style={{ color: m.isOwner ? C.purpleL : C.textFaint, fontSize: 12 }}>{m.role}</Text>
                        {!m.isOwner && (
                          <View style={{
                            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
                            backgroundColor: m.committed ? "rgba(52,211,153,0.15)" : C.fieldBg,
                          }}>
                            <Text style={{ color: m.committed ? "#34D399" : C.textFaint, fontSize: 10, fontWeight: "600" }}>
                              {m.committed ? "Committed" : "Pending"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Remove — owners only, and never against themselves */}
                    {isOwner && !m.isOwner && (
                      <Btn
                        onPress={() => confirmRemoveMember(m)}
                        disabled={removingId === m.userId}
                        accessibilityLabel={`Remove ${name} from the project`}
                        style={{
                          minWidth: 44, minHeight: 44,
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {removingId === m.userId ? (
                          <ActivityIndicator size="small" color={C.danger} />
                        ) : (
                          <UserMinus size={s(18)} color={C.danger} strokeWidth={1.8} />
                        )}
                      </Btn>
                    )}
                  </View>
                );
              })}

              {/* Quit Project — only shown to non-owner members */}
              {!isOwner && membership && (
                <>
                  <View style={{ height: 1, backgroundColor: C.borderSubtle, marginVertical: 4 }} />
                  <Pressable
                    onPress={() => { setShowInfo(false); setShowQuitSheet(true); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: s(10), paddingVertical: vs(6) }}
                  >
                    <View style={{
                      width: s(36), height: s(36), borderRadius: s(10),
                      backgroundColor: "rgba(248,113,113,0.10)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <DoorOpen size={s(16)} color={C.danger} strokeWidth={1.8} />
                    </View>
                    <Text style={{ color: C.danger, fontSize: fs(14), fontWeight: "500" }}>Quit Project</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
