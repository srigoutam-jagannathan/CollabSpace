/**
 * GradientBtn — primary CTA button with purple→pink gradient.
 * Use wherever a solid #7c3aed button existed before.
 */
import { View, Text, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

interface GradientBtnProps {
  onPress: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Use a softer gradient variant */
  soft?: boolean;
  children?: React.ReactNode;
}

export function GradientBtn({
  onPress,
  label,
  loading,
  disabled,
  style,
  soft,
  children,
}: GradientBtnProps) {
  const { tokens: { C, GRADIENT } } = useTheme();
  const colors = soft ? GRADIENT.ctaSoft : GRADIENT.cta;

  return (
    <Btn
      onPress={onPress}
      disabled={disabled || loading}
      pressScale={0.97}
      accessibilityLabel={label}
      // Btn owns disabled dimming — setting opacity here would be silently overridden.
      style={[{ borderRadius: s(32), overflow: "hidden" }, style]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: s(32), paddingVertical: vs(16), alignItems: "center", paddingHorizontal: s(20) }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : children ? (
          children
        ) : (
          <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(16) }}>{label}</Text>
        )}
      </LinearGradient>
    </Btn>
  );
}
