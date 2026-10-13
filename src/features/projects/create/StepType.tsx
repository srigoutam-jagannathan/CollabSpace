import { View, Text } from "react-native";
import { PROJECT_TYPES } from "@/constants/projectOptions";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { Tile } from "./Tile";
import type { ProjectDraft } from "./draft";

interface Props {
  draft: ProjectDraft;
  update: (patch: Partial<ProjectDraft>) => void;
  /** Picking a type moves straight on, so the container handles it. */
  onPick: (value: string) => void;
}

export function StepType({ draft, onPick }: Props) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ gap: vs(16) }}>
      <View style={{ gap: vs(6) }}>
        <Text accessibilityRole="header" style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22) }}>What are you starting?</Text>
        <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>Pick the one that fits best.</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(10) }}>
        {PROJECT_TYPES.map((t) => (
          <Tile
            key={t.value}
            size="card"
            label={t.label}
            hint={t.hint}
            selected={draft.projectType === t.value}
            onPress={() => onPick(t.value)}
          />
        ))}
      </View>
    </View>
  );
}
