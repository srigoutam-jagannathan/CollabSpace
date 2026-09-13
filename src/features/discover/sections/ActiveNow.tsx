import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { ActiveItem } from "../types";

export function ActiveNow({ items }: { items: ActiveItem[] }) {
  const { tokens: { C, GLASS } } = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: s(20), gap: s(8) }}
    >
      {items.map(item => {
        const events = `${item.event_count} ${item.event_count === 1 ? "event" : "events"} this week`;
        return (
          <Btn
            key={item.id}
            onPress={() => router.push({ pathname: "/(app)/projects/[id]/preview", params: { id: item.id } })}
            accessibilityLabel={`${item.title}. ${events}.`}
            pressScale={0.97}
            style={{
              width: s(118), borderRadius: s(13), padding: s(10),
              backgroundColor: GLASS.card.backgroundColor,
              borderWidth: 1, borderColor: GLASS.card.borderColor,
            }}
          >
            <Text style={{
              color: C.white, fontFamily: FONT.extraBold, fontSize: fs(12.5), marginBottom: vs(3),
            }} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={{
              color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(9.5), lineHeight: vs(14),
            }} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: s(4), marginTop: vs(7) }}>
              <View style={{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: C.success }} />
              <Text style={{ color: C.success, fontFamily: FONT.bold, fontSize: fs(9) }}>{events}</Text>
            </View>
          </Btn>
        );
      })}
    </ScrollView>
  );
}
