import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/features/auth/AuthContext";

export default function AuthLayout() {
  const { status } = useAuth();

  // If auth state changes to authenticated while inside the (auth) group
  // (e.g. dev bypass or successful OAuth callback), navigate to the app.
  if (status === "authenticated") {
    // "/(app)" resolves to the Stack's initial route, (tabs)/index. Typed routes
    // no longer list it because (app) has no index file of its own.
    return <Redirect href={"/(app)" as any} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "fade",
      }}
    />
  );
}
