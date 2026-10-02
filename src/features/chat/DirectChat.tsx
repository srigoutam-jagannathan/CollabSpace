import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { ProfileCardMessage } from "@/components/ProfileCardMessage";
import { Avatar } from "@/components/Avatar";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { ProfileCardMetadata } from "@/types/database";
import { ScreenLoader } from "@/components/ScreenLoader";

type DM = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  type?: string;
  metadata?: Record<string, unknown> | null;
};

type ConnectionRow = {
  requester_id: string;
  recipient_id: string;
  requester: { full_name: string | null; avatar_url: string | null } | null;
  recipient: { full_name: string | null; avatar_url: string | null } | null;
};

export function DirectChat({ connectionId }: { connectionId: string }) {
  const { tokens: { C } } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [otherName, setOtherName] = useState("Chat");
  const [otherId, setOtherId] = useState<string | null>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (!user || !connectionId) return;
    async function init() {
      const [{ data: conn, error: connErr }, { data: msgs, error: msgsErr }] = await Promise.all([
        supabase
          .from("connections")
          .select("requester_id, recipient_id, requester:profiles!requester_id(full_name, avatar_url), recipient:profiles!recipient_id(full_name, avatar_url)")
          .eq("id", connectionId)
          .single(),
        supabase
          .from("direct_messages")
          .select("id, sender_id, content, created_at, type, metadata")
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: true }),
      ]);

      if (connErr) {
        Alert.alert("Error", "Could not load conversation.");
        setLoading(false);
        return;
      }
      if (msgsErr) {
        Alert.alert("Error", "Could not load messages.");
        setLoading(false);
        return;
      }

      if (conn && user) {
        const c = conn as unknown as ConnectionRow;
        const isRequester = c.requester_id === user.id;
        const other = isRequester ? c.recipient : c.requester;
        setOtherName(other?.full_name ?? "Chat");
        setOtherId(isRequester ? c.recipient_id : c.requester_id);
        setOtherAvatar(other?.avatar_url ?? null);
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
          if (isNearBottomRef.current) {
            if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
            scrollTimerRef.current = setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      )
      .subscribe();
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [connectionId]);

  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || !user || sending) return;
    const userId = user.id;
    setSending(true);
    setInputText("");
    const { error } = await supabase.from("direct_messages").insert({
      connection_id: connectionId,
      sender_id: userId,
      content,
    });
    if (error) {
      setInputText(content);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
    setSending(false);
  }, [inputText, user, connectionId, sending]);

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const avatarInitials = useMemo(
    () =>
      otherName
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [otherName]
  );

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
          <Btn
            onPress={() => {
              if (otherId) router.push({ pathname: "/(app)/users/[id]", params: { id: otherId } });
            }}
            disabled={!otherId}
            pressScale={1}
            accessibilityLabel={`View ${otherName}'s profile`}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 44 }}
          >
            <View style={{ marginRight: s(10) }}>
              <Avatar url={otherAvatar} initials={avatarInitials} size={s(36)} bgColor={C.purple} />
            </View>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16), flex: 1 }} numberOfLines={1}>
              {otherName}
            </Text>
          </Btn>
        </View>

        {/* Messages */}
        {loading ? (
          <ScreenLoader />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: s(16), paddingVertical: vs(16), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (isNearBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              isNearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - vs(80);
            }}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: vs(80) }}>
                <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), textAlign: "center" }}>
                  Send your first message to {otherName} 👋
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isOwn = item.sender_id === user?.id;
              if (item.type === "profile_card" && item.metadata) {
                const meta = item.metadata as unknown as ProfileCardMetadata;
                return (
                  <View style={{ alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: vs(10), marginHorizontal: s(16) }}>
                    <ProfileCardMessage
                      metadata={meta}
                      onPress={() => router.push({ pathname: "/(app)/users/[id]", params: { id: meta.userId } })}
                    />
                  </View>
                );
              }
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
          backgroundColor: C.inputBg,
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
              backgroundColor: inputText.trim() ? C.purple : C.fieldBg,
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
