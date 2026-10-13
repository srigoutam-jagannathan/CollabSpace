import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

export function NoMatchesPrompt() {
  const { tokens: { C, GLASS } } = useTheme();
  const router = useRouter();

  const buttonStyle = {
    alignSelf: "flex-start" as const, paddingHorizontal: s(16), paddingVertical: vs(9),
    borderRadius: s(11), borderWidth: 1, borderColor: C.borderBright,
  };
  const labelStyle = { color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(12.5) };

  return (
    <View style={{ paddingHorizontal: s(20) }}>
      <View style={{
        borderRadius: s(17), padding: s(16),
        backgroundColor: GLASS.card.backgroundColor,
        borderWidth: 1, borderColor: GLASS.card.borderColor,
      }}>
        <Text style={{
          color: C.white, fontFamily: FONT.extraBold, fontSize: fs(15),
          marginBottom: vs(6),
        }}>
          Nothing needs your skills yet
        </Text>
        <Text style={{
          color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12),
          lineHeight: vs(18), marginBottom: vs(12),
        }}>
          New projects show up here when they&apos;re looking for something you&apos;re good at.
        </Text>
        <View style={{ flexDirection: "row", gap: s(8) }}>
          <Btn
            onPress={() => router.push("/search")}
            accessibilityLabel="Browse all projects"
            style={buttonStyle}
          >
            <Text style={labelStyle}>Browse all</Text>
          </Btn>
          <Btn
            onPress={() => router.push("/(app)/settings/skills")}
            accessibilityLabel="Edit your skills"
            style={buttonStyle}
          >
            <Text style={labelStyle}>Edit skills</Text>
          </Btn>
        </View>
      </View>
    </View>
  );
}
