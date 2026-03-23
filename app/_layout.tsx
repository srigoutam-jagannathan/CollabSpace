import "../global.css";
import { Text, View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { AuthProvider } from "@/features/auth/AuthContext";
import { GradientBg } from "@/components/GradientBg";

// All navigators inherit transparent background — GradientBg shows through
const AppTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent" },
};

// Apply Nunito as default font for every <Text> in the app
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: "Nunito_400Regular" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
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
