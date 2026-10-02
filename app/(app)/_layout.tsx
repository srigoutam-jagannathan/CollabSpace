import { useEffect, useState } from "react";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";

// A deep link straight to /users/x still gets the tabs underneath it, so
// back always has somewhere to go.
export const unstable_settings = { initialRouteName: "(tabs)" };

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * The tabs live in the (tabs) group. Every other screen (profiles, project
 * screens, settings, notifications, Discover sections, the archive) is
 * pushed over them by this Stack, so back returns to whatever was showing.
 */
export default function AppLayout() {
  const { status, user } = useAuth();
  const [skillsChecked, setSkillsChecked] = useState(false);
  const [skillsSet, setSkillsSet] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    const key = user ? `skills_set_${user.id}` : "skills_set";
    AsyncStorage.getItem(key).then((val) => {
      setSkillsSet(val === "true");
      setSkillsChecked(true);
    });
  }, [status, user?.id]);

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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
