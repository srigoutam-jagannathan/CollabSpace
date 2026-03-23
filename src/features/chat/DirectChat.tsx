import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

type DM = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function DirectChat({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [otherName, setOtherName] = useState("Chat");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user || !connectionId) return;
    async function init() {
      const [{ data: conn }, { data: msgs }] = await Promise.all([
        supabase
          .from("connections")
          .select("requester_id, recipient_id, requester:profiles!requester_id(full_name), recipient:profiles!recipient_id(full_name)")
          .eq("id", connectionId)
          .single(),
        supabase
          .from("direct_messages")
          .select("id, sender_id, content, created_at")
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: true }),
      ]);

      if (conn) {
        const isRequester = conn.requester_id === user!.id;
        const other = isRequester ? (conn as any).recipient : (conn as any).requester;
        setOtherName(other?.full_name ?? "Chat");
      }
      setMessages((msgs as DM[]) ?? []);
      setLoading(false);
    }
    init();
  }, [connectionId, user]);

  useEffect(() => {
    const channel = supabase
      .channel(`dm:${connectionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DM]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [connectionId]);

  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setInputText("");
    await supabase.from("direct_messages").insert({
      connection_id: connectionId,
      sender_id: user.id,
      content,
    });
    setSending(false);
  }, [inputText, user, connectionId, sending]);

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const avatarInitials = otherName.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: s(16), paddingVertical: vs(12),
          borderBottomWidth: 1, borderBottomColor: C.border,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: s(12) }}>
            <ArrowLeft size={s(22)} color={C.white} />
          </Pressable>
          <View style={{ width: s(36), height: s(36), borderRadius: s(18), backgroundColor: C.purple, alignItems: "center", justifyContent: "center", marginRight: s(10) }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(13) }}>{avatarInitials}</Text>
          </View>
          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16), flex: 1 }} numberOfLines={1}>
            {otherName}
          </Text>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={C.pink} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: s(16), paddingVertical: vs(16), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: vs(80) }}>
                <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), textAlign: "center" }}>
                  Send your first message to {otherName} 👋
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isOwn = item.sender_id === user?.id;
              return (
                <View style={{ alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: vs(10) }}>
                  <View style={{
                    maxWidth: "78%",
                    backgroundColor: isOwn ? C.purple : C.surface,
                    borderRadius: s(16),
                    borderBottomRightRadius: isOwn ? s(4) : s(16),
                    borderBottomLeftRadius: isOwn ? s(16) : s(4),
                    paddingHorizontal: s(14),
                    paddingVertical: vs(10),
                    borderWidth: isOwn ? 0 : 1,
                    borderColor: C.border,
                  }}>
                    <Text style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(14), lineHeight: vs(20) }}>
                      {item.content}
                    </Text>
                  </View>
                  <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(10), marginTop: vs(3), marginHorizontal: s(4) }}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: "row", alignItems: "flex-end",
          paddingHorizontal: s(16), paddingVertical: vs(12),
          borderTopWidth: 1, borderTopColor: C.border,
          backgroundColor: "rgba(10,1,32,0.95)",
        }}>
          <TextInput
            style={{
              flex: 1, color: C.white, fontFamily: FONT.regular,
              fontSize: fs(14), backgroundColor: C.surface,
              borderRadius: s(20), borderWidth: 1, borderColor: C.border,
              paddingHorizontal: s(16), paddingVertical: vs(10),
              maxHeight: vs(100), marginRight: s(10),
            }}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={C.textFaint}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            style={{
              width: s(44), height: s(44), borderRadius: s(22),
              backgroundColor: inputText.trim() ? C.purple : "rgba(255,255,255,0.08)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Send size={s(18)} color={inputText.trim() ? C.white : C.textFaint} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
