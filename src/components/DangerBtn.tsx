/**
 * DangerBtn — the destructive counterpart to GradientBtn.
 *
 * Shares GradientBtn's geometry exactly (same radius, vertical padding and
 * label size) so a destructive action stacked under a primary one reads as the
 * same kind of control. The previous one-off in the project preview used a
 * tighter radius, smaller padding and a lighter weight, which made it look
 * like a stray link rather than a button.
 *
 * It is filled rather than outline-only: a 35%-opacity red hairline over the
 * near-black surface is close to invisible on a phone, which is how "Leave
 * Project" ended up looking like bare text. The fill stays well below the
 * primary CTA's contrast, so the destructive option is unmistakably a button
 * without competing with the action most people actually want.
 */
import { Text, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { Btn } from "@/components/Btn";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

interface DangerBtnProps {
  onPress: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DangerBtn({ onPress, label, loading, disabled, style }: DangerBtnProps) {
  const { tokens: { C } } = useTheme();

  return (
    <Btn
      onPress={onPress}
      disabled={disabled || loading}
      pressScale={0.97}
      accessibilityLabel={label}
      style={[
        {
          borderRadius: s(32),
          paddingVertical: vs(16),
          paddingHorizontal: s(20),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(248,113,113,0.14)",
          borderWidth: 1,
          borderColor: "rgba(248,113,113,0.55)",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.danger} />
      ) : (
        <Text style={{ color: C.danger, fontFamily: FONT.bold, fontSize: fs(16) }}>
          {label}
        </Text>
      )}
    </Btn>
  );
}
