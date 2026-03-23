import { Stack } from "expo-router";

/**
 * Stack navigator for the chat tab group.
 * Handles: index (conversation list) and [id] (HandshakeChat per project).
 */
export default function ChatLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
