import { View, Text, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { ProfileCardMetadata } from "@/types/database";

type Props = {
  metadata: ProfileCardMetadata;
  onPress: () => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ProfileCardMessage({ metadata, onPress }: Props) {
  const { tokens: { C } } = useTheme();
  const { fullName, avatarUrl, university, department, skills } = metadata;
  const locationLine = [university, department].filter(Boolean).join(" · ");

  return (
    <Pressable onPress={onPress} style={{ maxWidth: s(264) }}>
      <View style={{
        backgroundColor: C.bgDeep,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: s(16),
        overflow: "hidden",
      }}>
        {/* Caramel accent stripe */}
        <View style={{ height: vs(3), backgroundColor: C.purpleL }} />

        <View style={{ padding: s(10) }}>
          {/* Identity row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
            <Avatar
              url={avatarUrl}
              initials={getInitials(fullName)}
              size={s(36)}
              bgColor={C.purple}
              ring
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14) }}
                numberOfLines={1}
              >
                {fullName ?? "Unknown"}
              </Text>
              {locationLine ? (
                <Text
                  style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(11), marginTop: vs(1) }}
                  numberOfLines={1}
                >
                  {locationLine}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={s(15)} color={C.purpleL} strokeWidth={2.2} />
          </View>

          {/* Skills */}
          {skills.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: C.borderSubtle, marginTop: vs(8), marginBottom: vs(7) }} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(5) }}>
                {skills.slice(0, 4).map((skill) => (
                  <View
                    key={skill}
                    style={{
                      borderRadius: s(20),
                      borderWidth: 1,
                      borderColor: C.borderSubtle,
                      paddingHorizontal: s(9),
                      paddingVertical: vs(3),
                    }}
                  >
                    <Text style={{ color: C.textMuted, fontFamily: FONT.medium, fontSize: fs(11) }}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
