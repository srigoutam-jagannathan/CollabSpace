import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";
import type { Project } from "@/types/database";

type ConnectionConvo = {
  id: string;          // connection id
  otherUserId: string;
  otherUserName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

function AvatarCircle({ initials }: { initials: string }) {
  return (
    <View style={{ width: s(48), height: s(48), borderRadius: s(24), backgroundColor: "#2d1b69", alignItems: "center", justifyContent: "center", marginRight: s(14) }}>
      <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(15) }}>{initials}</Text>
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
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"individual" | "group">("individual");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupProjects, setGroupProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionConvo[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  const fetchJoinedProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("project_members")
      .select("project:projects(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const joined = (data ?? [])
      .map((row: any) => row.project as Project)
      .filter(Boolean);
    setGroupProjects(joined);
    setLoading(false);
  }, [user]);

  const fetchConnections = useCallback(async () => {
    if (!user) { setLoadingConnections(false); return; }
    setLoadingConnections(true);
    const { data } = await supabase
      .from("connections")
      .select(`
        id, requester_id, recipient_id,
        requester:profiles!requester_id(id, full_name),
        recipient:profiles!recipient_id(id, full_name),
        direct_messages(content, created_at)
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
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
      };
    });
    setConnections(convos);
    setLoadingConnections(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchJoinedProjects();
      fetchConnections();
    }, [fetchJoinedProjects, fetchConnections])
  );

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
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: s(20), marginBottom: vs(16), backgroundColor: "#1e1040", borderRadius: s(28), paddingHorizontal: s(16), height: vs(44) }}>
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={{ flex: 1, color: "#ffffff", fontSize: 14, marginLeft: 10 }}
          placeholder="Search Messages"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tab toggle */}
      <View style={{ flexDirection: "row", marginHorizontal: 20, marginBottom: 8, backgroundColor: "#1e1040", borderRadius: 12, padding: 4 }}>
        <Pressable
          onPress={() => setActiveTab("individual")}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: activeTab === "individual" ? "#ffffff" : "transparent" }}
        >
          <Text style={{ color: activeTab === "individual" ? "#120a2e" : C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
            Individual Chats
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("group")}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: activeTab === "group" ? "#ffffff" : "transparent" }}
        >
          <Text style={{ color: activeTab === "group" ? "#120a2e" : C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
            Group Chats
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === "individual" ? (
        loadingConnections ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : filteredConnections.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(32) }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: fs(15), textAlign: "center" }}>
              No connections yet.{"\n"}Connect with talent in the Discover tab!
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredConnections}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: vs(100) }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: "/(app)/chat/dm/[id]", params: { id: item.id } })}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(14), borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
              >
                <AvatarCircle initials={getInitials(item.otherUserName)} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14), marginBottom: vs(2) }}>
                    {item.otherUserName}
                  </Text>
                  <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13) }} numberOfLines={1}>
                    {item.lastMessage ?? "Start a conversation"}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : filteredGroup.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, textAlign: "center" }}>
            No group chats yet.{"\n"}Join a project to start collaborating!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroup}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: vs(100) }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/(app)/chat/[id]", params: { id: item.id } })}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(14), borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
            >
              <AvatarCircle initials={getInitials(item.title)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14), marginBottom: vs(2) }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13) }} numberOfLines={1}>
                  Tap to open group chat
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
