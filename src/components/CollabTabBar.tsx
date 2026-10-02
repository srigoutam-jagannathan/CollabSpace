/**
 * CollabTabBar -- the app's custom bottom tab bar.
 *
 * Lives here rather than in app/(app)/_layout.tsx so it can be tested without
 * importing the whole authenticated layout (auth guard, unread polling,
 * Supabase). The layout passes it straight to <Tabs tabBar>.
 */
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { router, usePathname } from "expo-router";
// Not re-exported at expo-router's top level, so it comes from its
// vendored copy -- the one whose shape <Tabs> actually passes.
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react-native";
import { Btn } from "@/components/Btn";
import { useTheme } from "@/contexts/ThemeContext";
import type { CTokens } from "@/utils/theme";
import { s, vs } from "@/utils/scale";

type TabItem = {
  name: string;
  icon: (active: boolean, C: CTokens) => React.ReactNode;
  isFab?: boolean;
};

const TABS: TabItem[] = [
  {
    name: "index",
    icon: (active, C) => <Home size={s(22)} color={active ? C.white : C.textMuted} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "search",
    icon: (active, C) => <Search size={s(22)} color={active ? C.white : C.textMuted} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "fab",
    isFab: true,
    icon: (_active, C) => <Plus size={s(24)} color={C.white} strokeWidth={2.5} />,
  },
  {
    name: "chat",
    icon: (active, C) => <MessageCircle size={s(22)} color={active ? C.pink : C.textMuted} strokeWidth={active ? 2.5 : 1.8} />,
  },
  {
    name: "profile",
    icon: (active, C) => <User size={s(22)} color={active ? C.pink : C.textMuted} strokeWidth={active ? 2.5 : 1.8} />,
  },
];

export interface CollabTabBarProps extends BottomTabBarProps {
  hasChatUnread: boolean;
  onChatTabPress: () => void;
}

export function CollabTabBar({ state, navigation, hasChatUnread, onChatTabPress }: CollabTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens: { C, GRADIENT } } = useTheme();
  const pathname = usePathname();
  const fabGuardRef = useRef(false);

  useEffect(() => {
    fabGuardRef.current = false;
  }, [pathname]);

  return (
    <View
      style={{
        backgroundColor: C.tabBarBg,
        paddingHorizontal: s(12),
        paddingTop: vs(8),
        paddingBottom: Math.max(insets.bottom, vs(12)),
        borderTopWidth: 1,
        borderTopColor: C.borderBright,
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
          const activeRouteName = state.routes[state.index]?.name ?? "";
          // Stacks reached from a tab keep that tab lit — see audit finding 19.
          const OWNED_BY: Record<string, string> = {
            "discover/[section]": "index",
            // The folder has no _layout.tsx, so the registered route name is
            // "archive/index", not "archive" — same shape as discover above.
            "archive/index": "index",
            projects: "index",
            notifications: "index",
            "users/[id]": "index",
            settings: "profile",
          };
          const owner = OWNED_BY[activeRouteName] ?? activeRouteName;
          const focused = tab.name === owner;

          if (tab.isFab) {
            return (
              <View key={tab.name} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Btn
                  onPress={() => {
                    if (fabGuardRef.current) return;
                    fabGuardRef.current = true;
                    router.navigate("/(app)/projects/create" as any);
                  }}
                  style={{ borderRadius: s(26), overflow: "hidden" }}
                  hitSlop={8}
                  pressScale={0.92}
                  debounceMs={0}
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
                    if (event.defaultPrevented) return;
                    // The chat tab owns a Stack, so a plain navigate restores
                    // whatever conversation was left on top of it. Pressing the
                    // tab should land on the conversation list, the way tapping
                    // an active tab pops to root everywhere else.
                    if (tab.name === "chat") {
                      navigation.navigate(route.name, { screen: "index" });
                    } else {
                      navigation.navigate(route.name);
                    }
                  }
                }}
                style={{ alignItems: "center", paddingVertical: vs(4), paddingHorizontal: s(12) }}
                hitSlop={8}
                pressScale={0.88}
              >
                <View style={{ position: "relative" }}>
                  {tab.icon(focused, C)}
                  {tab.name === "chat" && hasChatUnread && (
                    <View style={{
                      position: "absolute", top: -2, right: -3,
                      width: s(9), height: s(9), borderRadius: s(5),
                      backgroundColor: C.pink, borderWidth: 1.5, borderColor: C.bgDeep,
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
