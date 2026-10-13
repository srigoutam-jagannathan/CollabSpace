import { View, Text } from "react-native";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

interface Props {
  title: string;
  description: string;
  /** From describeTimeframe(); null hides the line. */
  timeframe: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  /** Given, the owner row is a button (to their profile). */
  onOwnerPress?: () => void;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/**
 * A compact "what is this project" card: the join screen keeps it above the
 * form, and Create Project's last step uses it as the listing preview.
 */
export function ProjectSummaryCard({
  title, description, timeframe, ownerName, ownerAvatarUrl, onOwnerPress,
}: Props) {
  const { tokens: { C, GLASS } } = useTheme();

  // "" and "   " would otherwise show a blank name and an empty avatar.
  const name = ownerName?.trim() || "Unknown";

  const owner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
      <Avatar url={ownerAvatarUrl} initials={initials(name)} size={s(24)} />
      <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12) }}>Started by</Text>
      <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(12) }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );

  return (
    <View style={{
      borderRadius: s(16), padding: s(16), gap: vs(8),
      backgroundColor: GLASS.card.backgroundColor,
      borderWidth: 1, borderColor: GLASS.card.borderColor,
    }}>
      <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(17) }} numberOfLines={2}>
        {title}
      </Text>
      <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), lineHeight: vs(19) }} numberOfLines={3}>
        {description}
      </Text>
      {timeframe ? (
        <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(12) }}>{timeframe}</Text>
      ) : null}
      {onOwnerPress ? (
        <Btn
          onPress={onOwnerPress}
          accessibilityLabel={`Started by ${name}. Opens their profile.`}
          hitSlop={8}
          style={{ alignSelf: "flex-start", marginTop: vs(2) }}
        >
          {owner}
        </Btn>
      ) : (
        // accessible groups the avatar, "Started by" and name into one screen-reader stop.
        <View accessible accessibilityLabel={`Started by ${name}`} style={{ marginTop: vs(2) }}>{owner}</View>
      )}
    </View>
  );
}
