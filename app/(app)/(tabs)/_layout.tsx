import { useEffect, useState, useCallback, useRef } from "react";
import { Tabs } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { CollabTabBar } from "@/components/CollabTabBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * The five tabs and the chat unread badge. The auth and skills guards live in
 * the parent (app) Stack, which pushes every non-tab screen over this one.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const [hasChatUnread, setHasChatUnread] = useState(false);
  // Persisted ISO timestamp of when the user last opened the chat tab.
  // Defaults to a far-past date so all existing unread messages are caught.
  const chatLastOpenRef = useRef("2020-01-01T00:00:00.000Z");
  const CHAT_LAST_OPEN_KEY = "chat_last_open";

  // Check BOTH direct_messages (individual) and chat_messages (group)
  // since the last time the user opened the chat tab.
  const checkUnreadMessages = useCallback(async () => {
    if (!user?.id) return;
    const notifRaw = await AsyncStorage.getItem("notif_prefs");
    const notifPrefs = notifRaw ? JSON.parse(notifRaw) : {};
    if (notifPrefs.newMessages === false) { setHasChatUnread(false); return; }
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

  return (
    <Tabs
      tabBar={(props) => (
        <CollabTabBar
          {...props}
          hasChatUnread={hasChatUnread}
          onChatTabPress={() => {
            chatLastOpenRef.current = new Date().toISOString();
            setHasChatUnread(false);
          }}
        />
      )}
      // SDK 57 / React Navigation 7: the navigator-level sceneContainerStyle
      // and the old contentStyle screen option are both gone, replaced by the
      // sceneStyle screen option.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      // Only governs Android back between tabs now: pushed screens are popped
      // by the (app) Stack. "history" returns to the previously selected tab
      // rather than always to the first one.
      backBehavior="history"
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="fab" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
