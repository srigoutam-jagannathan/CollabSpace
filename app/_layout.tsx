import "../global.css";
import { Text, View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { useFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from "@expo-google-fonts/lato";
import { AuthProvider } from "@/features/auth/AuthContext";
import { GradientBg } from "@/components/GradientBg";

// All navigators inherit transparent background — GradientBg shows through
const AppTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent" },
};

// Apply Lato as default font for every <Text> in the app
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: "Lato_400Regular" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  // Hold render until fonts are ready — GradientBg still shows during load
  return (
    <ThemeProvider value={AppTheme}>
      <AuthProvider>
        <StatusBar style="light" />
        {/* GradientBg is position:absolute — renders behind content */}
        <View style={{ flex: 1 }}>
          <GradientBg />
          {/* Slot fills the same space, painted on top of the SVG */}
          <View style={{ flex: 1 }}>
            {fontsLoaded && <Slot />}
          </View>
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}
