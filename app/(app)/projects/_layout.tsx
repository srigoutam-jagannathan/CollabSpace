import { Stack } from "expo-router";

/**
 * Stack navigator for the projects tab group.
 * Handles: index (My Projects), create, and [id]/insights.
 * headerShown: false — each screen manages its own header via SafeAreaView.
 */
export default function ProjectsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
