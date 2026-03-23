import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/features/auth/AuthContext";

export default function AuthLayout() {
  const { status } = useAuth();

  // If auth state changes to authenticated while inside the (auth) group
  // (e.g. dev bypass or successful OAuth callback), navigate to the app.
  if (status === "authenticated") {
    return <Redirect href="/(app)/" />;
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
