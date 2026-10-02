import { useEffect, useState, useCallback, useRef } from "react";
import { Redirect, Tabs } from "expo-router";
import { View, Text, AppState, type AppStateStatus } from "react-native";
import { CollabTabBar } from "@/components/CollabTabBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";

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
            chatLastOpenRef.current = new Date().toISOString();
            setHasChatUnread(false);
          }}
        />
      )}
      // SDK 57 / React Navigation 7: the navigator-level sceneContainerStyle
      // and the old contentStyle screen option are both gone, replaced by the
      // sceneStyle screen option.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      // Default is "firstRoute", which sends every back press to the first tab
      // regardless of where you were. "history" returns to the tab you came
      // from -- but only for switches the TabRouter itself handled, which means
      // tab bar presses. A cross-tab push (opening a profile from a DM) builds
      // its own state, never reaches changeIndex, and so leaves this history
      // empty; GO_BACK then returns null and bubbles to the root. Those screens
      // carry their origin in a route param instead -- see useOpenProfile.
      backBehavior="history"
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="fab" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="projects" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="users/[id]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="discover/[section]" options={{ href: null }} />
      <Tabs.Screen name="archive/index" options={{ href: null }} />
    </Tabs>
  );
}
