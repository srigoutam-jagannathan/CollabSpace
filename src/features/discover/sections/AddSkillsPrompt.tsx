import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

export function AddSkillsPrompt() {
  const { tokens: { C, GLASS } } = useTheme();
  const router = useRouter();

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
          Tell us what you&apos;re good at
        </Text>
        <Text style={{
          color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12),
          lineHeight: vs(18), marginBottom: vs(12),
        }}>
          Add your skills and we&apos;ll show you the projects looking for exactly them.
        </Text>
        <Btn
          onPress={() => router.push({ pathname: "/(onboarding)/skills", params: { from: "discover" } })}
          accessibilityLabel="Add your skills"
          style={{
            alignSelf: "flex-start", paddingHorizontal: s(16), paddingVertical: vs(9),
            borderRadius: s(11), borderWidth: 1, borderColor: C.borderBright,
          }}
        >
          <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(12.5) }}>
            Add skills
          </Text>
        </Btn>
      </View>
    </View>
  );
}
