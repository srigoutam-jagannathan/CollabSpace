/**
 * ScreenLoader — the one full-screen loading state.
 *
 * Every screen used to hand-roll this: a flex:1 centred View plus an
 * ActivityIndicator whose colour was picked per file (C.pink, C.purple,
 * C.purpleL, C.white and one hardcoded hex between them). The container is
 * deliberately transparent — GradientBg is mounted at the root and paints
 * behind every route, so anything opaque here would punch a flat rectangle
 * through the gradient mid-load.
 */
import { View, ActivityIndicator, Text, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/utils/theme";
import { fs, vs } from "@/utils/scale";

export function ScreenLoader({
  label,
  size = "large",
  style,
}: {
  /** Shown under the spinner. Also what assistive tech reads out. */
  label?: string;
  size?: "small" | "large";
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens: { C } } = useTheme();

  return (
    <View
      style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
    >
      <ActivityIndicator size={size} color={C.purple} />
      {label ? (
        <Text
          style={{
            color: C.textMuted,
            fontFamily: FONT.regular,
            fontSize: fs(13),
            marginTop: vs(12),
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
