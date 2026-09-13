import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Entry point — routes by auth status.
 * Unauthenticated users always see the welcome screen first.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#c08552" />
      </View>
    );
  }

  if (status === "authenticated") {
    return <Redirect href="/(app)/" />;
  }

  if (status === "access_restricted") {
    return <Redirect href="/(auth)/access-restricted" />;
  }

  // Not authenticated → always show welcome screen
  return <Redirect href="/(auth)/onboarding" />;
}
