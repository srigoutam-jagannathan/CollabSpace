import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { X, Link2, MessageSquare, ChevronLeft, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, H } from "@/utils/scale";

type Props = {
  visible: boolean;
  profileId: string;
  profileName: string | null;
  avatarUrl: string | null;
  university: string | null;
  department: string | null;
  skills: string[];
  onClose: () => void;
};

type ConvItem =
  | { kind: "dm"; connectionId: string; name: string }
  | { kind: "group"; projectId: string; title: string };

export function ShareProfileSheet({
  visible,
  profileId,
  profileName,
  avatarUrl,
  university,
  department,
  skills,
  onClose,
}: Props) {
  const { tokens: { C, GLASS } } = useTheme();
  const { user } = useAuth();
  const slideAnim = useRef(new Animated.Value(H)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  const [view, setView] = useState<"options" | "picker">("options");
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [fetchingConvs, setFetchingConvs] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  function flashToast() {
    setToastVisible(true);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(toastAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      setToastVisible(false);
      onClose();
    });
  }

  useEffect(() => {
    if (visible) {
      setView("options");
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H,
        duration: 220,
        useNativeDriver: true,
      }).start();
      setConversations([]);
      setSendingTo(null);
    }
  }, [visible]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setFetchingConvs(true);
    const [{ data: conns }, { data: memberships }, { data: ownedProjects }] = await Promise.all([
      supabase
        .from("connections")
        .select(
          "id, requester_id, recipient_id, requester:profiles!requester_id(full_name), recipient:profiles!recipient_id(full_name)"
        )
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq("status", "accepted"),
      supabase
        .from("project_members")
        .select("project:projects!project_id(id, title)")
        .eq("user_id", user.id)
        .eq("mou_accepted", true),
      supabase
        .from("projects")
        .select("id, title")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const items: ConvItem[] = [];

    for (const c of conns ?? []) {
      const isRequester = c.requester_id === user.id;
      const otherName = isRequester
        ? (c.recipient as any)?.full_name
        : (c.requester as any)?.full_name;
      items.push({ kind: "dm", connectionId: c.id, name: otherName ?? "Unknown" });
    }

    // Merge member projects + owned projects, deduped by project ID
    const seenProjectIds = new Set<string>();
    for (const m of memberships ?? []) {
      const project = m.project as any;
      if (project?.id && project?.title && !seenProjectIds.has(project.id)) {
        seenProjectIds.add(project.id);
        items.push({ kind: "group", projectId: project.id, title: project.title });
      }
    }
    for (const p of (ownedProjects ?? []) as { id: string; title: string }[]) {
      if (!seenProjectIds.has(p.id)) {
        seenProjectIds.add(p.id);
        items.push({ kind: "group", projectId: p.id, title: p.title });
      }
    }

    setConversations(items);
    setFetchingConvs(false);
  }, [user]);

  async function handleShareLink() {
    try {
      await Share.share({
        message: `Check out ${profileName ?? "this profile"} on CollabSpace`,
        url: `collabspace://users/${profileId}`,
      });
    } catch {
      // user dismissed
    }
    onClose();
  }

  async function handleSendInChat() {
    setView("picker");
    fetchConversations();
  }

  async function handleSend(item: ConvItem) {
    if (!user) return;
    const key = item.kind === "dm" ? item.connectionId : item.projectId;
    setSendingTo(key);

    const metadata = { userId: profileId, fullName: profileName, avatarUrl, university, department, skills };
    const content = `Shared ${profileName ?? "a profile"}`;

    let error: any = null;
    if (item.kind === "dm") {
      ({ error } = await supabase.from("direct_messages").insert({
        connection_id: item.connectionId,
        sender_id: user.id,
        content,
        type: "profile_card",
        metadata,
      }));
    } else {
      ({ error } = await supabase.from("chat_messages").insert({
        project_id: item.projectId,
        sender_id: user.id,
        content,
        type: "profile_card",
        metadata,
      }));
    }

    setSendingTo(null);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    flashToast();
  }

  const dmItems = conversations.filter((c) => c.kind === "dm") as Extract<ConvItem, { kind: "dm" }>[];
  const groupItems = conversations.filter((c) => c.kind === "group") as Extract<ConvItem, { kind: "group" }>[];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
        onPress={onClose}
      />
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: slideAnim }],
          backgroundColor: C.bgDeep,
          borderTopLeftRadius: s(24),
          borderTopRightRadius: s(24),
          borderTopWidth: 1,
          borderColor: C.border,
          maxHeight: H * 0.80,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: "center", paddingTop: vs(12), paddingBottom: vs(4) }}>
          <View style={{ width: s(36), height: vs(4), borderRadius: s(2), backgroundColor: C.borderSubtle }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingBottom: vs(16) }}>
          {view === "picker" ? (
            <Btn onPress={() => setView("options")} pressScale={0.88} hitSlop={10} style={{ marginRight: s(8) }}>
              <ChevronLeft size={s(22)} color={C.textMuted} strokeWidth={2} />
            </Btn>
          ) : null}
          <Text style={{ flex: 1, color: C.white, fontFamily: FONT.bold, fontSize: fs(17) }}>
            {view === "options" ? "Share Profile" : "Send in Chat"}
          </Text>
          <Btn onPress={onClose} pressScale={0.88} hitSlop={10}>
            <X size={s(20)} color={C.textMuted} strokeWidth={2} />
          </Btn>
        </View>

        {view === "options" ? (
          <View style={{ paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) }}>
            {/* Share Link */}
            <Btn onPress={handleShareLink} pressScale={0.97}>
              <View style={{
                backgroundColor: GLASS.card.backgroundColor,
                borderWidth: 1,
                borderColor: GLASS.card.borderColor,
                borderRadius: s(16),
                padding: s(16),
                flexDirection: "row",
                alignItems: "center",
                gap: s(14),
              }}>
                <View style={{ width: s(40), height: s(40), borderRadius: s(20), backgroundColor: "rgba(192,133,82,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Link2 size={s(20)} color={C.purpleL} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(15) }}>Share Link</Text>
                  <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(2) }}>
                    Copy or send via any app
                  </Text>
                </View>
              </View>
            </Btn>

            {/* Send in Chat */}
            <Btn onPress={handleSendInChat} pressScale={0.97}>
              <View style={{
                backgroundColor: GLASS.card.backgroundColor,
                borderWidth: 1,
                borderColor: GLASS.card.borderColor,
                borderRadius: s(16),
                padding: s(16),
                flexDirection: "row",
                alignItems: "center",
                gap: s(14),
              }}>
                <View style={{ width: s(40), height: s(40), borderRadius: s(20), backgroundColor: "rgba(192,133,82,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare size={s(20)} color={C.purpleL} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(15) }}>Send in Chat</Text>
                  <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(2) }}>
                    Share to a direct or group chat
                  </Text>
                </View>
              </View>
            </Btn>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(40) }}
          >
            {fetchingConvs ? (
              <ActivityIndicator size="small" color={C.purple} style={{ marginVertical: vs(24) }} />
            ) : conversations.length === 0 ? (
              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), textAlign: "center", marginVertical: vs(24) }}>
                No conversations found.
              </Text>
            ) : (
              <>
                {dmItems.length > 0 && (
                  <>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(11), textTransform: "uppercase", letterSpacing: 0.5, marginBottom: vs(8) }}>
                      Direct Messages
                    </Text>
                    <View style={{ gap: vs(8), marginBottom: vs(16) }}>
                      {dmItems.map((item) => {
                        const isSending = sendingTo === item.connectionId;
                        return (
                          <Btn key={item.connectionId} onPress={() => handleSend(item)} pressScale={0.97} disabled={isSending}>
                            <View style={{
                              backgroundColor: GLASS.card.backgroundColor,
                              borderWidth: 1,
                              borderColor: GLASS.card.borderColor,
                              borderRadius: s(12),
                              padding: s(14),
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}>
                              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14) }}>{item.name}</Text>
                              {isSending && <ActivityIndicator size="small" color={C.purple} />}
                            </View>
                          </Btn>
                        );
                      })}
                    </View>
                  </>
                )}

                {groupItems.length > 0 && (
                  <>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(11), textTransform: "uppercase", letterSpacing: 0.5, marginBottom: vs(8) }}>
                      Group Chats
                    </Text>
                    <View style={{ gap: vs(8) }}>
                      {groupItems.map((item) => {
                        const isSending = sendingTo === item.projectId;
                        return (
                          <Btn key={item.projectId} onPress={() => handleSend(item)} pressScale={0.97} disabled={isSending}>
                            <View style={{
                              backgroundColor: GLASS.card.backgroundColor,
                              borderWidth: 1,
                              borderColor: GLASS.card.borderColor,
                              borderRadius: s(12),
                              padding: s(14),
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}>
                              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14) }}>{item.title}</Text>
                              {isSending && <ActivityIndicator size="small" color={C.purple} />}
                            </View>
                          </Btn>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Success toast */}
        {toastVisible && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              opacity: toastAnim,
            }}
          >
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(10),
              backgroundColor: C.bgDeep,
              borderWidth: 1,
              borderColor: C.success,
              borderRadius: s(32),
              paddingHorizontal: s(20),
              paddingVertical: vs(12),
            }}>
              <View style={{
                width: s(22),
                height: s(22),
                borderRadius: s(11),
                backgroundColor: C.success,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Check size={s(13)} color={C.bgDeep} strokeWidth={2.8} />
              </View>
              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14) }}>
                Profile sent
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}
