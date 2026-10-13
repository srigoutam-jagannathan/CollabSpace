import { Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { ArchiveItem } from "./types";

/** Under each archive card: the Connect button, or a note for example projects. */
export function ArchivePageAction({ item, onConnect }: {
  item: ArchiveItem;
  onConnect: (item: ArchiveItem) => void;
}) {
  const { tokens: { C, GRADIENT } } = useTheme();

  if (item.is_example) {
    return (
      <Text style={{
        color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12),
        textAlign: "center", marginTop: vs(14),
      }}>
        Example project. Real ones appear here as teams ship.
      </Text>
    );
  }

  return (
    <Btn
      onPress={() => onConnect(item)}
      accessibilityLabel={`Connect with the team behind ${item.title}`}
      style={{ marginTop: vs(10), borderRadius: s(14), overflow: "hidden" }}
    >
      <LinearGradient
        colors={GRADIENT.ctaSoft}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(12.5) }}>
          Connect with the team
        </Text>
      </LinearGradient>
    </Btn>
  );
}
