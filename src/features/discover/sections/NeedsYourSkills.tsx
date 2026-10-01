import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useOpenProjectPreview } from "@/utils/originLink";
import { roleMeter, projectPills } from "../cardMeta";
import type { NeedsItem } from "../types";

function calloutText(matched: string[]): string {
  if (matched.length === 1) return `${matched[0]} — that's you`;
  return `Matches ${matched.slice(0, 2).join(" + ")}`;
}

export function NeedsYourSkills({ items }: { items: NeedsItem[] }) {
  const { tokens: { C, GLASS, GRADIENT } } = useTheme();
  const router = useRouter();
  const openPreview = useOpenProjectPreview();

  return (
    <View style={{ paddingHorizontal: s(20) }}>
      {items.map(item => {
        const meter = roleMeter(item.member_count, item.looking_for);
        const pills = projectPills(item);
        const matched = item.matched_roles.length > 0;

        const label = matched
          ? `${item.title}. Needs a ${item.matched_roles[0]}, which matches your skills. ${meter.label}.`
          : `${item.title}. ${meter.label}.`;

        return (
          <Btn
            key={item.id}
            onPress={() => openPreview(item.id)}
            accessibilityLabel={`${label} Opens the project.`}
            pressScale={0.98}
            style={{
              borderRadius: s(17), padding: s(13), marginBottom: vs(9),
              backgroundColor: GLASS.card.backgroundColor,
              borderWidth: 1, borderColor: GLASS.card.borderColor,
            }}
          >
            {matched && (
              <View style={{
                alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: s(5),
                backgroundColor: "rgba(192,133,82,0.20)", borderWidth: 1,
                borderColor: C.borderBright, borderRadius: s(7),
                paddingHorizontal: s(8), paddingVertical: vs(3), marginBottom: vs(7),
              }}>
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(8) }}
                >
                  ◆
                </Text>
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

            {/* Segments only render when the project declared its roles, so a
                project of unknown capacity can never look fully staffed. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: s(6), marginTop: vs(9), flexWrap: "wrap" }}>
              {meter.kind === "roles" && (
                <View style={{ flexDirection: "row", gap: s(3) }}>
                  {Array.from({ length: meter.total }, (_, i) => (
                    <View key={i} style={{
                      width: s(15), height: vs(4), borderRadius: s(2),
                      backgroundColor: i < meter.filled ? C.purpleL : C.switchTrackOff,
                    }} />
                  ))}
                </View>
              )}
              <Text style={{ color: C.textFaint, fontFamily: FONT.bold, fontSize: fs(9.5) }}>
                {meter.label}
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(4), marginTop: vs(8) }}>
              {pills.map(pill => (
                <View
                  key={pill.label}
                  style={{
                    borderRadius: s(7), paddingHorizontal: s(7), paddingVertical: vs(2.5),
                    borderWidth: 1,
                    backgroundColor: pill.tone === "open" ? "rgba(52,211,153,0.12)" : C.surface,
                    borderColor: pill.tone === "open" ? "rgba(52,211,153,0.30)" : GLASS.card.borderColor,
                  }}
                >
                  <Text style={{
                    color: pill.tone === "open" ? C.success : C.textMuted,
                    fontFamily: FONT.bold, fontSize: fs(9.5),
                  }}>
                    {pill.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Its own pressable, not decoration on the card. Tapping the card
                opens the project; tapping this goes straight to the join form. */}
            <Btn
              onPress={() => router.push({ pathname: "/(app)/projects/[id]/join", params: { id: item.id } })}
              accessibilityLabel={`Ask to join ${item.title}`}
              pressScale={0.97}
              style={{ marginTop: vs(11), borderRadius: s(10), overflow: "hidden" }}
            >
              <LinearGradient
                colors={GRADIENT.ctaSoft}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: s(12) }}
              >
                <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(11.5) }}>
                  Ask to join
                </Text>
              </LinearGradient>
            </Btn>
          </Btn>
        );
      })}
    </View>
  );
}
