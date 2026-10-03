import "../global.css";
import { useEffect } from "react";
import { Text, View, Platform, LogBox } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
// expo-router 57 vendors React Navigation and re-exports these; importing
// from @react-navigation/native gives a second, structurally incompatible
// copy of the same types.
import { ThemeProvider as NavigationThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { useFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from "@expo-google-fonts/lato";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { AuthProvider } from "@/features/auth/AuthContext";
import { GradientBg } from "@/components/GradientBg";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// Push notification token registration — runs once per session when authenticated.
// expo-notifications is required lazily (inside the guard) because its module-level
// side effects (DevicePushTokenAutoRegistration.fx.js) make network calls on import.
// Skipping the require entirely in Expo Go prevents those calls from ever firing.
function PushTokenRegistrar() {
  const { user, status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    if (!Device.isDevice) return;
    // Expo Go removed remote push in SDK 53 — skip entirely to prevent module-level
    // network side effects from DevicePushTokenAutoRegistration.fx.js
    if ((Constants as any).executionEnvironment === "storeClient") return;
    if ((Constants as any).appOwnership === "expo") return;

    (async () => {
      try {
        // Lazy require keeps the module uninitialised in Expo Go
        const Notifications = require("expo-notifications");

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status: requested } = await Notifications.requestPermissionsAsync();
          finalStatus = requested;
        }
        if (finalStatus !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        await supabase
          .from("push_tokens")
          .upsert({ user_id: user.id, token: tokenData.data, updated_at: new Date().toISOString() });
      } catch {
        // Push token registration is best-effort; don't surface errors to the user
      }
    })();
  }, [status, user]);

  return null;
}

// @supabase/auth-js logs this with a bare console.error inside
// _recoverAndRefresh, then removes the dead session itself. It fires whenever a
// persisted session outlives its refresh token -- reinstalling, switching
// environments, or just leaving the app closed long enough -- and there is
// nothing for anyone to act on: the user lands on the sign-in screen, which is
// correct. Scoped to the exact message so real AuthApiErrors still surface, and
// dev-only, because LogBox is the only place it is ever shown as an error.
if (__DEV__) {
  LogBox.ignoreLogs([/Invalid Refresh Token: Refresh Token Not Found/]);
}

// Apply Lato as default font for every <Text> in the app
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: "Lato_400Regular" };

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "light" ? "dark" : "light"} />;
}

function ThemedNavigationProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();
  const base = mode === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider value={{ ...base, colors: { ...base.colors, background: "transparent" } }}>
      {children}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  // Hold render until fonts are ready — GradientBg still shows during load
  return (
    <ThemeProvider>
      <ThemedNavigationProvider>
        <AuthProvider>
          <PushTokenRegistrar />
          <ThemedStatusBar />
          {/* GradientBg is position:absolute — renders behind content */}
          <View style={{ flex: 1 }}>
            <GradientBg />
            {/* Slot fills the same space, painted on top of the SVG */}
            <View style={{ flex: 1 }}>
              {fontsLoaded && <Slot />}
            </View>
          </View>
        </AuthProvider>
      </ThemedNavigationProvider>
    </ThemeProvider>
  );
}
