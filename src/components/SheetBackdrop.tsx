/**
 * SheetBackdrop / SheetSurface — the shared chrome behind every bottom sheet.
 *
 * All four sheets used to dim with a flat `rgba(0,0,0,0.55)` and then draw the
 * panel itself in GLASS.card, which is 8% opacity in dark mode. Nothing was
 * ever blurred, so "glass" was a faint tint: the screen behind stayed legible
 * through the panel, and the tab bar in particular read straight through the
 * bottom of every sheet.
 *
 * Both pieces are blurred here. The backdrop frosts the screen behind the
 * sheet; the surface frosts what is behind the panel, so the tab bar is
 * obscured rather than tinted. The dim tint stays on top of the blur -- blur
 * alone lifts the average brightness and leaves the sheet competing with the
 * content behind it.
 */
import { Pressable, View, Platform, type ViewStyle, type StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs } from "@/utils/scale";

// Android has no native backdrop blur; this is the supported opt-in and is
// still marked experimental upstream. On the devices where it is unavailable
// the BlurView degrades to its tint, which is why every tint below is opaque
// enough to stand on its own.
const ANDROID_BLUR = Platform.OS === "android"
  ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
  : {};

export function SheetBackdrop({ onPress }: { onPress?: () => void }) {
  const { mode } = useTheme();

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <BlurView
        intensity={28}
        tint={mode === "light" ? "light" : "dark"}
        style={{ flex: 1 }}
        {...ANDROID_BLUR}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: mode === "light"
              ? "rgba(40,24,18,0.28)"
              : "rgba(9,5,4,0.46)",
          }}
        />
      </BlurView>
    </Pressable>
  );
}

export function SheetSurface({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  /** Applied to the blurred panel — transform, maxHeight and the like. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the padded content inside it — gap, and any padding override. */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { mode, tokens: { GLASS } } = useTheme();

  return (
    <BlurView
      intensity={mode === "light" ? 60 : 44}
      tint={mode === "light" ? "light" : "dark"}
      // overflow:hidden so the blur is clipped to the rounded top corners
      // instead of squaring them off.
      style={[
        {
          overflow: "hidden",
          borderTopLeftRadius: s(24),
          borderTopRightRadius: s(24),
          borderTopWidth: 1,
          borderTopColor: GLASS.card.borderColor,
        },
        style,
      ]}
      {...ANDROID_BLUR}
    >
      <View
        style={[
          {
            backgroundColor: mode === "light"
              ? "rgba(250,240,228,0.72)"
              : "rgba(31,18,16,0.78)",
            paddingHorizontal: s(24),
            paddingTop: vs(20),
            paddingBottom: vs(44),
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </BlurView>
  );
}
