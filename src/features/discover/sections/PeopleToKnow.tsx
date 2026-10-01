import { View, Text, ScrollView } from "react-native";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, ts } from "@/utils/scale";
import { useOpenProfile } from "@/utils/originLink";
import type { PersonItem } from "../types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function shortName(name: string | null): string {
  if (!name) return "Unknown";
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

interface PeopleToKnowProps {
  items: PersonItem[];
  /**
   * "rail" (default) is the horizontally-scrolling strip used on the
   * Discover screen. "row" renders each item as a full-width card with no
   * ScrollView wrapper, for use as a single item inside another list (the
   * see-all screen) — a fixed-width rail card one-per-row would otherwise
   * render left-aligned with its own dead scroll gesture.
   */
  variant?: "rail" | "row";
}

export function PeopleToKnow({ items, variant = "rail" }: PeopleToKnowProps) {
  const { tokens: { C, GLASS } } = useTheme();
  const openProfile = useOpenProfile();

  if (variant === "row") {
    return (
      <>
        {items.map(person => {
          const uni = person.university === "qub" ? "QUB" : person.university === "ulster" ? "Ulster" : "";
          const meta = [person.department, uni].filter(Boolean).join(" · ");
          return (
            <Btn
              key={person.id}
              onPress={() => openProfile(person.id)}
              accessibilityLabel={`${person.full_name ?? "Unknown"}${meta ? `. ${meta}` : ""}. Opens their profile.`}
              pressScale={0.98}
              style={{
                flexDirection: "row", alignItems: "center", gap: s(12),
                borderRadius: s(13), padding: s(12), marginHorizontal: s(20), marginBottom: vs(10),
                backgroundColor: GLASS.card.backgroundColor,
                borderWidth: 1, borderColor: GLASS.card.borderColor,
              }}
            >
              <Avatar url={person.avatar_url} initials={initials(person.full_name)} size={s(42)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(13) }} numberOfLines={1}>
                  {shortName(person.full_name)}
                </Text>
                {meta ? (
                  <Text style={{
                    color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11), marginTop: vs(2),
                  }} numberOfLines={1}>
                    {meta}
                  </Text>
                ) : null}
              </View>
            </Btn>
          );
        })}
      </>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: s(20), gap: s(8) }}
    >
      {items.map(person => {
        const uni = person.university === "qub" ? "QUB" : person.university === "ulster" ? "Ulster" : "";
        const meta = [person.department, uni].filter(Boolean).join(" · ");
        return (
          <Btn
            key={person.id}
            onPress={() => openProfile(person.id)}
            accessibilityLabel={`${person.full_name ?? "Unknown"}${meta ? `. ${meta}` : ""}. Opens their profile.`}
            pressScale={0.97}
            style={{
              width: ts(96), borderRadius: s(13), paddingVertical: vs(11), paddingHorizontal: s(8),
              alignItems: "center",
              backgroundColor: GLASS.card.backgroundColor,
              borderWidth: 1, borderColor: GLASS.card.borderColor,
            }}
          >
            <Avatar url={person.avatar_url} initials={initials(person.full_name)} size={s(38)} />
            <Text style={{
              color: C.white, fontFamily: FONT.bold, fontSize: fs(11), marginTop: vs(7),
            }} numberOfLines={1}>
              {shortName(person.full_name)}
            </Text>
            {meta ? (
              <Text style={{
                color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(9), marginTop: vs(2),
              }} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </Btn>
        );
      })}
    </ScrollView>
  );
}
