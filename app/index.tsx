import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/AuthContext";
import { ScreenLoader } from "@/components/ScreenLoader";

/**
 * Entry point — routes by auth status.
 * Unauthenticated users always see the welcome screen first.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return <ScreenLoader />;
  }

  if (status === "authenticated") {
    // "/(app)" resolves to the Stack's initial route, (tabs)/index. Typed routes
    // no longer list it because (app) has no index file of its own.
    return <Redirect href={"/(app)" as any} />;
  }

  if (status === "access_restricted") {
    return <Redirect href="/(auth)/access-restricted" />;
  }

  // Not authenticated → always show welcome screen
  return <Redirect href="/(auth)/onboarding" />;
}
