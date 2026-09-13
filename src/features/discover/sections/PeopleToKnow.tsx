import { Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
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

export function PeopleToKnow({ items }: { items: PersonItem[] }) {
  const { tokens: { C, GLASS } } = useTheme();
  const router = useRouter();

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
            onPress={() => router.push({ pathname: "/(app)/users/[id]", params: { id: person.id } })}
            accessibilityLabel={`${person.full_name ?? "Unknown"}${meta ? `. ${meta}` : ""}. Opens their profile.`}
            pressScale={0.97}
            style={{
              width: s(96), borderRadius: s(13), paddingVertical: vs(11), paddingHorizontal: s(8),
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
