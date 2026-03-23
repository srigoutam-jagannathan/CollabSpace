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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Send, FileSignature, Check, Info } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import type { ChatMessage, Project, ProjectMember, Profile } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageWithSender = ChatMessage & {
  sender: Pick<Profile, "id" | "full_name" | "university">;
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
}: {
  message: MessageWithSender;
  isOwn: boolean;
}) {
  const isQUB = message.sender.university === "qub";

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12, maxWidth: "80%", alignSelf: isOwn ? "flex-end" : "flex-start" }}>
      {!isOwn && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: isQUB ? "#8B0000" : "#006E6D" }} />
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
            {message.sender.full_name ?? "Anonymous"}
          </Text>
        </View>
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
      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3, paddingHorizontal: 4, textAlign: isOwn ? "right" : "left" }}>
        {new Date(message.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
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
  const [signingMOU, setSigningMOU] = useState(false);

  const hasSigned = membership?.mou_accepted === true;

  // ── Initial data load ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!projectId || !user) return;

    const [projectRes, messagesRes, membershipRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("chat_messages")
        .select("*, sender:profiles!sender_id(id, full_name, university)")
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
            .select("id, full_name, university")
            .eq("id", newMsg.sender_id)
            .single();

          const enriched: MessageWithSender = {
            ...newMsg,
            sender: senderData ?? { id: newMsg.sender_id, full_name: null, university: "qub" },
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

  // ── Sign MOU ────────────────────────────────────────────────────────────────

  const signMOU = () => {
    if (!user || !projectId || signingMOU || hasSigned) return;

    Alert.alert(
      "Sign Memorandum of Understanding",
      "By signing, you confirm your commitment to this project. This will be recorded as a collaboration event.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign MOU",
          onPress: async () => {
            setSigningMOU(true);

            try {
              if (membership) {
                await supabase
                  .from("project_members")
                  .update({
                    mou_accepted: true,
                    mou_accepted_at: new Date().toISOString(),
                  })
                  .eq("id", membership.id);
              } else {
                await supabase.from("project_members").insert({
                  project_id: projectId,
                  user_id: user.id,
                  role: "Member",
                  mou_accepted: true,
                  mou_accepted_at: new Date().toISOString(),
                });
              }

              // Append-only audit event
              await supabase.from("collaboration_events").insert({
                project_id: projectId,
                user_id: user.id,
                event_type: "mou_signed",
                metadata: { signed_at: new Date().toISOString() },
              });

              // Refresh membership state
              const { data } = await supabase
                .from("project_members")
                .select("*")
                .eq("project_id", projectId)
                .eq("user_id", user.id)
                .single();

              if (data) setMembership(data as ProjectMember);
            } catch {
              Alert.alert("Error", "Failed to sign MOU. Please try again.");
            }

            setSigningMOU(false);
          },
        },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2d1b69" }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }} hitSlop={12}>
          <ChevronLeft size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
            {project?.title ?? "Loading…"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Project Chat</Text>
        </View>

        <Pressable
          style={{ marginRight: 10 }}
          onPress={() =>
            router.push({ pathname: "/(app)/projects/[id]/insights", params: { id: projectId } })
          }
          hitSlop={12}
        >
          <Info size={20} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {hasSigned ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
            <Check size={13} color="#10b981" />
            <Text style={{ color: "#10b981", fontSize: 12, fontWeight: "600" }}>MOU Signed</Text>
          </View>
        ) : (
          <Pressable
            onPress={signMOU}
            disabled={signingMOU}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" }}
          >
            {signingMOU ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <>
                <FileSignature size={13} color="#f59e0b" />
                <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600" }}>Sign MOU</Text>
              </>
            )}
          </Pressable>
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
              renderItem={({ item }) => (
                <MessageBubble message={item} isOwn={item.sender_id === user?.id} />
              )}
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
    </SafeAreaView>
  );
}
