import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Search } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { Project } from "@/types/database";

type ConnectionConvo = {
  id: string;          // connection id
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
};

type GroupConvo = Project & {
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
};

function AvatarCircle({ url, initials, hasUnread }: { url?: string | null; initials: string; hasUnread?: boolean }) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ position: "relative", marginRight: s(14) }}>
      <View style={{ width: s(48), height: s(48), borderRadius: s(24), backgroundColor: C.avatarBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {url ? (
          <Image source={{ uri: url }} style={{ width: s(48), height: s(48) }} />
        ) : (
          <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(15) }}>{initials}</Text>
        )}
      </View>
      {hasUnread && (
        <View style={{
          position: "absolute", top: 1, right: 1,
          width: s(11), height: s(11), borderRadius: s(6),
          backgroundColor: C.pink, borderWidth: 2, borderColor: C.bgDeep,
        }} />
      )}
    </View>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function MessagesScreen() {
  const { tokens: { C } } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"individual" | "group">("individual");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupProjects, setGroupProjects] = useState<GroupConvo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionConvo[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [chatLastOpen, setChatLastOpen] = useState("2020-01-01T00:00:00.000Z");

  const fetchJoinedProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch both: projects the user is an approved member of, and projects they own.
    // Owners may not be in project_members for older projects, so we query both sources.
    const [{ data: memberRows }, { data: ownedRows }] = await Promise.all([
      supabase
        .from("project_members")
        .select("project:projects(*)")
        .eq("user_id", user.id)
        .eq("mou_accepted", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const seen = new Set<string>();
    const joined: Project[] = [];
    for (const row of (memberRows ?? [])) {
      const p = (row as any).project as Project;
      if (p && !seen.has(p.id)) { seen.add(p.id); joined.push(p); }
    }
    for (const p of (ownedRows ?? []) as Project[]) {
      if (p && !seen.has(p.id)) { seen.add(p.id); joined.push(p); }
    }

    if (joined.length === 0) {
      setGroupProjects([]);
      setLoading(false);
      return;
    }

    const projectIds = joined.map((p) => p.id);
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("project_id, content, created_at, sender_id")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(projectIds.length * 10);

    const lastMsgMap = new Map<string, { content: string; created_at: string; sender_id: string }>();
    for (const msg of (msgs ?? [])) {
      if (!lastMsgMap.has(msg.project_id)) lastMsgMap.set(msg.project_id, msg);
    }

    setGroupProjects(joined.map((p) => {
      const m = lastMsgMap.get(p.id) ?? null;
      return { ...p, lastMessage: m?.content ?? null, lastMessageAt: m?.created_at ?? null, lastMessageSenderId: m?.sender_id ?? null };
    }));
    setLoading(false);
  }, [user]);

  const fetchConnections = useCallback(async () => {
    if (!user) { setLoadingConnections(false); return; }
    setLoadingConnections(true);
    const { data } = await supabase
      .from("connections")
      .select(`
        id, requester_id, recipient_id,
        requester:profiles!requester_id(id, full_name, avatar_url),
        recipient:profiles!recipient_id(id, full_name, avatar_url),
        direct_messages(content, created_at, sender_id)
      `)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .order("created_at", { referencedTable: "direct_messages", ascending: false })
      .limit(1, { referencedTable: "direct_messages" });

    const convos: ConnectionConvo[] = (data ?? []).map((c: any) => {
      const isRequester = c.requester_id === user.id;
      const other = isRequester ? c.recipient : c.requester;
      const lastMsg = c.direct_messages?.[0] ?? null;
      return {
        id: c.id,
        otherUserId: other?.id ?? "",
        otherUserName: other?.full_name ?? "Unknown",
        otherUserAvatarUrl: other?.avatar_url ?? null,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
        lastMessageSenderId: lastMsg?.sender_id ?? null,
      };
    });
    setConnections(convos);
    setLoadingConnections(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      // Load the threshold from last time the user LEFT this screen
      AsyncStorage.getItem("chat_last_open").then((val) => {
        if (val) setChatLastOpen(val);
      });
      fetchJoinedProjects();
      fetchConnections();
      // Mark all conversations as seen when the user leaves
      return () => {
        AsyncStorage.setItem("chat_last_open", new Date().toISOString());
      };
    }, [fetchJoinedProjects, fetchConnections])
  );

  // Realtime: refresh list when a new DM/group message arrives OR a connection is accepted
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-list-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => { fetchConnections(); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => { fetchJoinedProjects(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "connections" },
        (payload) => {
          if ((payload.new as any).status === "accepted") fetchConnections();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchConnections, fetchJoinedProjects]);

  const filteredConnections = searchQuery.trim()
    ? connections.filter((c) =>
        c.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : connections;

  const filteredGroup = searchQuery.trim()
    ? groupProjects.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : groupProjects;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(16) }}>
        <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(26) }}>Messages</Text>
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: s(20), marginBottom: vs(16), backgroundColor: C.inputBg, borderRadius: s(28), paddingHorizontal: s(16), height: vs(44) }}>
        <Search size={16} color={C.textMuted} />
        <TextInput
          style={{ flex: 1, color: C.white, fontSize: 14, marginLeft: 10 }}
          placeholder="Search Messages"
          placeholderTextColor={C.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tab toggle */}
      <View style={{ flexDirection: "row", marginHorizontal: s(20), marginBottom: vs(8), backgroundColor: C.inputBg, borderRadius: s(14), padding: s(4) }}>
        <Pressable
          onPress={() => setActiveTab("individual")}
          style={{ flex: 1, paddingVertical: vs(10), borderRadius: s(10), alignItems: "center", backgroundColor: activeTab === "individual" ? C.tabActiveBg : "transparent" }}
        >
          <Text style={{ color: activeTab === "individual" ? C.tabActiveText : C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
            Individual Chats
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("group")}
          style={{ flex: 1, paddingVertical: vs(10), borderRadius: s(10), alignItems: "center", backgroundColor: activeTab === "group" ? C.tabActiveBg : "transparent" }}
        >
          <Text style={{ color: activeTab === "group" ? C.tabActiveText : C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
            Group Chats
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === "individual" ? (
        loadingConnections ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={C.purple} />
          </View>
        ) : filteredConnections.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(32) }}>
            <Text style={{ color: C.textMuted, fontSize: fs(15), textAlign: "center" }}>
              No connections yet.{"\n"}Connect with talent in the Discover tab!
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredConnections}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: vs(100) }}
            renderItem={({ item }) => {
              const unread =
                item.lastMessageSenderId !== null &&
                item.lastMessageSenderId !== user?.id &&
                (item.lastMessageAt ?? "") > chatLastOpen;
              return (
                <Pressable
                  onPress={() => router.push({ pathname: "/(app)/chat/dm/[id]", params: { id: item.id } })}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(14), borderBottomWidth: 1, borderBottomColor: C.borderSubtle, backgroundColor: unread ? "rgba(192,133,82,0.12)" : "transparent" }}
                >
                  <AvatarCircle
                    url={item.otherUserAvatarUrl}
                    initials={getInitials(item.otherUserName)}
                    hasUnread={unread}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: unread ? C.white : C.textMuted, fontFamily: unread ? FONT.bold : FONT.regular, fontSize: fs(14), marginBottom: vs(2) }}>
                      {item.otherUserName}
                    </Text>
                    <Text style={{ color: unread ? C.white : C.textFaint, fontFamily: unread ? FONT.semiBold : FONT.regular, fontSize: fs(13) }} numberOfLines={1}>
                      {item.lastMessage ?? "Start a conversation"}
                    </Text>
                  </View>
                  {unread && (
                    <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: C.pink, marginLeft: s(8) }} />
                  )}
                </Pressable>
              );
            }}
          />
        )
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.purple} />
        </View>
      ) : filteredGroup.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: C.textMuted, fontSize: 15, textAlign: "center" }}>
            No group chats yet.{"\n"}Join a project to start collaborating!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroup}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: vs(100) }}
          renderItem={({ item }) => {
            const unread =
              item.lastMessageSenderId !== null &&
              item.lastMessageSenderId !== user?.id &&
              (item.lastMessageAt ?? "") > chatLastOpen;
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/(app)/chat/[id]", params: { id: item.id } })}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(14), borderBottomWidth: 1, borderBottomColor: C.borderSubtle, backgroundColor: unread ? "rgba(192,133,82,0.12)" : "transparent" }}
              >
                <AvatarCircle url={item.chat_icon_url} initials={getInitials(item.title)} hasUnread={unread} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: unread ? C.white : C.textMuted, fontFamily: unread ? FONT.bold : FONT.regular, fontSize: fs(14), marginBottom: vs(2) }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={{ color: unread ? C.white : C.textFaint, fontFamily: unread ? FONT.semiBold : FONT.regular, fontSize: fs(13) }} numberOfLines={1}>
                    {item.lastMessage ?? "Tap to open group chat"}
                  </Text>
                </View>
                {unread && (
                  <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: C.pink, marginLeft: s(8) }} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
