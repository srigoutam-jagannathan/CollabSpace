import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, ts } from "@/utils/scale";
import type { ShippedItem } from "../types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

/** "Delivered March" — the year is implied on a rail this recent. */
function monthLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Delivered";
  return `Delivered ${date.toLocaleDateString("en-GB", { month: "long" })}`;
}

/**
 * The doorway into the Archive.
 *
 * Every tile opens the deck rather than a project page — the archive is this
 * rail's see-all view, so there is nowhere else for a tap to sensibly go.
 */
export function ShippedRail({ items }: { items: ShippedItem[] }) {
  const { tokens: { C } } = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: s(20), gap: s(8) }}
    >
      {items.map(item => (
        <Btn
          key={item.id}
          onPress={() => router.push("/(app)/archive")}
          accessibilityLabel={`${item.is_example ? "Example project: " : ""}${item.title}, ${monthLabel(item.delivered_at).toLowerCase()}. Opens the archive.`}
          pressScale={0.97}
          style={{
            width: ts(136), height: vs(96), borderRadius: s(13), overflow: "hidden",
            borderWidth: 1, borderColor: C.border,
            justifyContent: "flex-end", padding: s(9),
          }}
        >
          <ProjectBackdrop projectId={item.id} coverUrl={item.cover_url} veil="tile" />

          {item.is_example && (
            <View style={{
              position: "absolute", top: s(7), left: s(7),
              backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)", borderRadius: s(6),
              paddingHorizontal: s(5), paddingVertical: vs(2),
            }}>
              <Text style={{ color: "#fff", fontFamily: FONT.extraBold, fontSize: fs(8), letterSpacing: 0.4 }}>
                EXAMPLE
              </Text>
            </View>
          )}

          <Text style={{
            color: C.white, fontFamily: FONT.extraBold, fontSize: fs(13), letterSpacing: -0.2,
          }} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={{
            color: "rgba(255,248,240,0.65)", fontFamily: FONT.bold, fontSize: fs(8.5),
            textTransform: "uppercase", letterSpacing: 0.4, marginTop: vs(1),
          }} numberOfLines={1}>
            {monthLabel(item.delivered_at)}
          </Text>

          <View style={{ flexDirection: "row", marginTop: vs(5) }}>
            {item.faces.map((face, i) => (
              <View key={face.id} style={{ marginLeft: i === 0 ? 0 : -s(5) }}>
                <Avatar url={face.avatar_url} initials={initials(face.full_name)} size={s(15)} />
              </View>
            ))}
          </View>
        </Btn>
      ))}
    </ScrollView>
  );
}
