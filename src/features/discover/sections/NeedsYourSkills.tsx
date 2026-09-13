import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { NeedsItem } from "../types";

function calloutText(matched: string[]): string {
  if (matched.length === 1) return `${matched[0]} — that's you`;
  return `Matches ${matched.slice(0, 2).join(" + ")}`;
}

export function NeedsYourSkills({ items }: { items: NeedsItem[] }) {
  const { tokens: { C, GLASS, GRADIENT } } = useTheme();
  const router = useRouter();

  return (
    <View style={{ paddingHorizontal: s(20) }}>
      {items.map(item => {
        const total = item.member_count + item.looking_for.length;
        const meter = `${item.member_count} of ${total} roles filled`;
        // matched_roles is expected non-empty here — rankNeeds() upstream
        // excludes rows with no overlap — but guard the label anyway so a
        // row that somehow slips through reads as "3 of 5 roles filled"
        // rather than "Needs a undefined, which matches your skills."
        const label = item.matched_roles.length > 0
          ? `${item.title}. Needs a ${item.matched_roles[0]}, which matches your skills. ${meter}.`
          : `${item.title}. ${meter}.`;

        return (
          <Btn
            key={item.id}
            onPress={() => router.push({ pathname: "/(app)/projects/[id]/preview", params: { id: item.id } })}
            accessibilityLabel={label}
            pressScale={0.98}
            style={{
              borderRadius: s(17), padding: s(13), marginBottom: vs(9),
              backgroundColor: GLASS.card.backgroundColor,
              borderWidth: 1, borderColor: GLASS.card.borderColor,
            }}
          >
            {item.matched_roles.length > 0 && (
            <View style={{
              alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
              backgroundColor: "rgba(192,133,82,0.20)", borderWidth: 1,
              borderColor: C.borderBright, borderRadius: s(7),
              paddingHorizontal: s(8), paddingVertical: vs(3), marginBottom: vs(7),
            }}>
              <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(10) }}>
                {calloutText(item.matched_roles)}
              </Text>
            </View>
            )}

            <Text style={{
              color: C.white, fontFamily: FONT.extraBold, fontSize: fs(15.5),
              letterSpacing: -0.2, marginBottom: vs(5),
            }} numberOfLines={1}>
              {item.title}
            </Text>

            <Text style={{
              color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(11.5), lineHeight: vs(17),
            }} numberOfLines={2}>
              {item.description}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: s(6), marginTop: vs(9) }}>
              <View style={{ flexDirection: "row", gap: s(3) }}>
                {Array.from({ length: total }, (_, i) => (
                  <View key={i} style={{
                    width: s(15), height: vs(4), borderRadius: s(2),
                    backgroundColor: i < item.member_count ? C.purpleL : C.switchTrackOff,
                  }} />
                ))}
              </View>
              <Text style={{ color: C.textFaint, fontFamily: FONT.bold, fontSize: fs(9.5) }}>
                {meter}
              </Text>
            </View>

            <LinearGradient
              colors={GRADIENT.ctaSoft}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: s(10), paddingVertical: vs(8), alignItems: "center", marginTop: vs(11) }}
            >
              <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(11.5) }}>
                Ask to join
              </Text>
            </LinearGradient>
          </Btn>
        );
      })}
    </View>
  );
}
