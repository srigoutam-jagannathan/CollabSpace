import { Text, ScrollView } from "react-native";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useOpenProjectPreview } from "@/utils/originLink";
import type { PulseItem } from "../types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function verb(eventType: PulseItem["event_type"]): string {
  return eventType === "join" ? "joined" : "signed an MOU with";
}

export function PulseStrip({ items }: { items: PulseItem[] }) {
  const { tokens: { C } } = useTheme();
  const openPreview = useOpenProjectPreview();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: s(20), gap: s(14) }}
      style={{
        paddingVertical: vs(9),
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
      }}
    >
      {items.map(item => (
        <Btn
          key={item.id}
          onPress={() => openPreview(item.project_id)}
          accessibilityLabel={`${item.actor_name ?? "Someone"} ${verb(item.event_type)} ${item.project_title}`}
          // The strip is deliberately thin — roughly 24pt of content — so the
          // 44pt minimum target is reached with hitSlop rather than by making
          // the whole section taller. Horizontal slop stays under half the
          // s(14) gap so neighbouring items can't swallow each other's taps.
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <Avatar url={item.actor_avatar_url} initials={initials(item.actor_name)} size={s(22)} />
          <Text
            style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(10) }}
            numberOfLines={2}
          >
            <Text style={{ color: C.white, fontFamily: FONT.bold }}>
              {item.actor_name?.split(" ")[0] ?? "Someone"}
            </Text>
            {` ${verb(item.event_type)}\n`}
            <Text style={{ color: C.white, fontFamily: FONT.bold }}>{item.project_title}</Text>
          </Text>
        </Btn>
      ))}
    </ScrollView>
  );
}
