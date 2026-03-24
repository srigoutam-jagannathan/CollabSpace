import { useEffect, useState, useCallback, useRef } from "react";
import { Redirect, Tabs, router } from "expo-router";
import { View, Text, AppState, type AppStateStatus, type BottomTabBarProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { C, GRADIENT } from "@/utils/theme";
import { s, vs } from "@/utils/scale";

type TabItem = {
  name: string;
  icon: (active: boolean) => React.ReactNode;
  isFab?: boolean;
};

const TABS: TabItem[] = [
  {
    name: "index",
    icon: (active) => <Home size={s(22)} color={active ? C.white : "rgba(255,255,255,0.38)"} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "search",
    icon: (active) => <Search size={s(22)} color={active ? C.white : "rgba(255,255,255,0.38)"} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "fab",
    isFab: true,
    icon: () => <Plus size={s(24)} color={C.white} strokeWidth={2.5} />,
  },
  {
    name: "chat",
    icon: (active) => <MessageCircle size={s(22)} color={active ? C.pink : "rgba(255,255,255,0.38)"} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "profile",
    icon: (active) => <User size={s(22)} color={active ? C.pink : "rgba(255,255,255,0.38)"} strokeWidth={active ? 2.5 : 1.8} />,
  },
];

// ─── Tab bar ──────────────────────────────────────────────────────────────────

interface CollabTabBarProps extends BottomTabBarProps {
  hasChatUnread: boolean;
  onChatTabPress: () => void;
}

function CollabTabBar({ state, navigation, hasChatUnread, onChatTabPress }: CollabTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: "rgba(18,0,45,0.88)",
        paddingHorizontal: s(12),
        paddingTop: vs(8),
        paddingBottom: Math.max(insets.bottom, vs(12)),
        borderTopWidth: 1,
        borderTopColor: "rgba(200,62,210,0.25)",
      }}
    >
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: s(36),
          borderWidth: 1,
          borderColor: C.border,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: s(8),
          paddingVertical: vs(10),
        }}
      >
        {TABS.map((tab) => {
          const route = state.routes.find((r) => r.name === tab.name);
          const focused = route ? state.index === state.routes.indexOf(route) : false;

          if (tab.isFab) {
            return (
              <View key={tab.name} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Btn
                  onPress={() => router.push("/(app)/projects/create")}
                  style={{ borderRadius: s(26), overflow: "hidden" }}
                  hitSlop={8}
                  pressScale={0.92}
                >
                  <LinearGradient
                    colors={GRADIENT.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: s(52), height: s(52), borderRadius: s(26),
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Plus size={s(24)} color={C.white} strokeWidth={2.5} />
                  </LinearGradient>
                </Btn>
              </View>
            );
          }

          return (
            <View key={tab.name} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Btn
                onPress={() => {
                  if (tab.name === "chat") onChatTabPress();
                  if (route) {
                    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!event.defaultPrevented) navigation.navigate(route.name);
                  }
                }}
                style={{ alignItems: "center", paddingVertical: vs(4), paddingHorizontal: s(12) }}
                hitSlop={8}
                pressScale={0.88}
              >
                <View style={{ position: "relative" }}>
                  {tab.icon(focused)}
                  {tab.name === "chat" && hasChatUnread && (
                    <View style={{
                      position: "absolute", top: -2, right: -3,
                      width: s(9), height: s(9), borderRadius: s(5),
                      backgroundColor: C.pink, borderWidth: 1.5, borderColor: "rgba(18,0,45,1)",
                    }} />
                  )}
                </View>
              </Btn>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { status, user } = useAuth();
  const [skillsChecked, setSkillsChecked] = useState(false);
  const [skillsSet, setSkillsSet] = useState(true);
  const [hasChatUnread, setHasChatUnread] = useState(false);
  // Persisted ISO timestamp of when the user last opened the chat tab.
  // Defaults to a far-past date so all existing unread messages are caught.
  const chatLastOpenRef = useRef("2020-01-01T00:00:00.000Z");
  const CHAT_LAST_OPEN_KEY = "chat_last_open";

  useEffect(() => {
    if (status === "loading") return;
    const key = user ? `skills_set_${user.id}` : "skills_set";
    AsyncStorage.getItem(key).then((val) => {
      setSkillsSet(val === "true");
      setSkillsChecked(true);
    });
  }, [status, user?.id]);

  // Check BOTH direct_messages (individual) and chat_messages (group)
  // since the last time the user opened the chat tab.
  const checkUnreadMessages = useCallback(async () => {
    if (!user?.id) return;
    const since = chatLastOpenRef.current;

    // Run DM check + member lookup in parallel
    const [{ count: dmCount }, { data: memberData }] = await Promise.all([
      supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .gt("created_at", since),
      supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id),
    ]);

    if ((dmCount ?? 0) > 0) { setHasChatUnread(true); return; }

    const projectIds = (memberData ?? []).map((m: any) => m.project_id);
    if (projectIds.length === 0) { setHasChatUnread(false); return; }

    const { count: groupCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", user.id)
      .in("project_id", projectIds)
      .gt("created_at", since);

    setHasChatUnread((groupCount ?? 0) > 0);
  }, [user?.id]);

  useEffect(() => {
    // Restore persisted threshold, then run first check
    AsyncStorage.getItem(CHAT_LAST_OPEN_KEY).then((val) => {
      if (val) chatLastOpenRef.current = val;
      checkUnreadMessages();
    });
    // Foreground check (app goes background → active)
    const appSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") checkUnreadMessages();
    });
    // In-app realtime: fires while user is on a different tab
    const channel = supabase
      .channel("chat-badge-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, checkUnreadMessages)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, checkUnreadMessages)
      .subscribe();
    return () => {
      appSub.remove();
      supabase.removeChannel(channel);
    };
  }, [checkUnreadMessages]);

  if (status === "loading" || !skillsChecked) {
    return <View style={{ flex: 1 }} />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!skillsSet) {
    return <Redirect href="/(onboarding)/skills" />;
  }

  return (
    <Tabs
      tabBar={(props) => (
        <CollabTabBar
          {...props}
          hasChatUnread={hasChatUnread}
          onChatTabPress={() => {
            const now = new Date().toISOString();
            chatLastOpenRef.current = now;
            AsyncStorage.setItem(CHAT_LAST_OPEN_KEY, now);
            setHasChatUnread(false);
          }}
        />
      )}
      sceneContainerStyle={{ backgroundColor: "transparent" }}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="fab" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="projects" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="users/[id]" options={{ href: null }} />
    </Tabs>
  );
}
