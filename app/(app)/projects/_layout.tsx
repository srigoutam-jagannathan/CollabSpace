import { Stack } from "expo-router";

/**
 * Stack for the projects screens, pushed over the tabs.
 * Handles: index (My Projects), create, [id]/insights, [id]/preview, and [id]/join.
 * headerShown: false — each screen manages its own header via SafeAreaView.
 */
export default function ProjectsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
