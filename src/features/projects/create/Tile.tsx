import { Text } from "react-native";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

interface Props {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  /** Defaults to label. */
  accessibilityLabel?: string;
  /**
   * "card" fills half a row (type, duration); "chip" sizes to its text (roles, hours);
   * "full" is a card spanning the whole row (the learners toggle).
   */
  size?: "card" | "chip" | "full";
  /** An on/off setting rather than a pick: read as a switch that is checked or not. */
  isSwitch?: boolean;
}

/** A tappable choice. Selected tiles fill pink. */
export function Tile({ label, hint, selected, onPress, accessibilityLabel, size = "chip", isSwitch = false }: Props) {
  const { tokens: { C } } = useTheme();
  const card = size !== "chip";
  return (
    <Btn
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityRole={isSwitch ? "switch" : "button"}
      accessibilityState={isSwitch ? { checked: selected } : { selected }}
      pressScale={0.96}
      // A toggle, not a navigation: tapping twice quickly should undo, not be swallowed.
      debounceMs={0}
      style={{
        width: size === "card" ? "48%" : size === "full" ? "100%" : undefined,
        // A long custom role wraps inside the row instead of running off it.
        maxWidth: "100%",
        paddingHorizontal: s(14),
        paddingVertical: vs(card ? 16 : 9),
        borderRadius: s(card ? 16 : 20),
        borderWidth: 1.5,
        borderColor: selected ? C.pink : C.border,
        backgroundColor: selected ? C.pink : C.fieldBg,
      }}
    >
      <Text style={{ color: selected ? C.white : C.textMuted, fontFamily: selected ? FONT.semiBold : FONT.regular, fontSize: fs(card ? 15 : 13) }}>
        {label}
      </Text>
      {hint ? (
        <Text style={{ color: selected ? C.white : C.textFaint, fontFamily: FONT.regular, fontSize: fs(11.5), marginTop: vs(4) }}>
          {hint}
        </Text>
      ) : null}
    </Btn>
  );
}
