import { useEffect, useState } from "react";
import { Redirect, Tabs, router } from "expo-router";
import { View, Text, type BottomTabBarProps } from "react-native";
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
                      width: s(8), height: s(8), borderRadius: s(4),
                      backgroundColor: C.pink, borderWidth: 1.5, borderColor: C.surface,
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

  useEffect(() => {
    if (status === "loading") return;
    const key = user ? `skills_set_${user.id}` : "skills_set";
    AsyncStorage.getItem(key).then((val) => {
      setSkillsSet(val === "true");
      setSkillsChecked(true);
    });
  }, [status, user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          if ((payload.new as any).sender_id !== user.id) {
            setHasChatUnread(true);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
      tabBar={(props) => <CollabTabBar {...props} hasChatUnread={hasChatUnread} onChatTabPress={() => setHasChatUnread(false)} />}
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
