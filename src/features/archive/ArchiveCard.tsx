import { View, Text } from "react-native";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { deliveredLabel, teamLabel } from "./format";
import { FACES_SHOWN } from "./queries";
import type { ArchiveItem } from "./types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

/** Proof chips render only for links that exist — an absent one says nothing. */
function proofChips(item: ArchiveItem): string[] {
  const chips: string[] = [];
  if (item.github_repo_url) chips.push("GitHub");
  if (item.figma_url) chips.push("Figma");
  return chips;
}

/**
 * One completed project, full screen.
 *
 * Leads with the outcome and ends on the team, because the decision this card
 * asks for is "connect with these people", not "join this project" — a
 * finished project has no roles left to fill.
 */
export function ArchiveCard({ item }: { item: ArchiveItem }) {
  const { tokens: { C } } = useTheme();
  const delivered = deliveredLabel(item.delivered_at);
  const chips = proofChips(item);
  const overflow = item.team_count - item.team.length;

  return (
    <View
      accessible
      accessibilityLabel={`${item.title}. ${delivered}. ${teamLabel(item.team_count)}.`}
      style={{
        flex: 1, borderRadius: s(22), overflow: "hidden",
        borderWidth: 1, borderColor: C.border,
        justifyContent: "flex-end", padding: s(17),
      }}
    >
      <ProjectBackdrop projectId={item.id} coverUrl={item.cover_url} />

      <View style={{
        alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: s(5),
        backgroundColor: "rgba(52,211,153,0.14)", borderWidth: 1,
        borderColor: "rgba(52,211,153,0.34)", borderRadius: s(7),
        paddingHorizontal: s(8), paddingVertical: vs(3), marginBottom: vs(8),
      }}>
        <Text style={{ color: C.success, fontFamily: FONT.extraBold, fontSize: fs(9.5), letterSpacing: 0.3 }}>
          {`✓ SHIPPED · ${delivered.replace("Delivered ", "").toUpperCase()}`}
        </Text>
      </View>

      <Text style={{
        color: C.white, fontFamily: FONT.extraBold, fontSize: fs(27),
        letterSpacing: -0.7, lineHeight: vs(29), marginBottom: vs(6),
      }} numberOfLines={2}>
        {item.title}
      </Text>

      <Text style={{
        color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), lineHeight: vs(18),
      }} numberOfLines={4}>
        {item.description}
      </Text>

      <View style={{
        marginTop: vs(13), paddingTop: vs(12),
        borderTopWidth: 1, borderTopColor: "rgba(255,248,240,0.13)",
      }}>
        <Text style={{
          color: C.textFaint, fontFamily: FONT.extraBold, fontSize: fs(8.5),
          letterSpacing: 0.6, textTransform: "uppercase", marginBottom: vs(7),
        }}>
          Built by
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          {item.team.map((member, i) => (
            // Overlapped deliberately; the negative margin is what makes this
            // read as one team rather than a list of separate people.
            <View key={member.id} style={{ marginLeft: i === 0 ? 0 : -s(7), zIndex: FACES_SHOWN - i }}>
              <Avatar url={member.avatar_url} initials={initials(member.full_name)} size={s(27)} />
            </View>
          ))}
          <Text style={{
            marginLeft: s(14), color: C.textMuted, fontFamily: FONT.bold, fontSize: fs(10.5),
          }}>
            {overflow > 0
              ? `${teamLabel(item.team_count)} · +${overflow} more`
              : teamLabel(item.team_count)}
          </Text>
        </View>
      </View>

      {chips.length > 0 && (
        <View style={{ flexDirection: "row", gap: s(5), marginTop: vs(11) }}>
          {chips.map(chip => (
            <View key={chip} style={{
              backgroundColor: "rgba(255,248,240,0.08)", borderWidth: 1, borderColor: C.border,
              borderRadius: s(7), paddingHorizontal: s(8), paddingVertical: vs(3.5),
            }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.bold, fontSize: fs(9.5) }}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
