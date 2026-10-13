import { View, Text } from "react-native";
import { Btn } from "@/components/Btn";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { COLLAB_STYLES, COMMITMENT_HOURS, DURATIONS } from "@/constants/projectOptions";
import { describeTimeframe } from "@/utils/projectTimeframe";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { Tile } from "./Tile";
import type { ProjectDraft, Step } from "./draft";

interface Props {
  draft: ProjectDraft;
  update: (patch: Partial<ProjectDraft>) => void;
  /** Jumps back to an earlier step; the draft is kept. */
  onEdit: (step: Step) => void;
}

const hoursLabel = (h: number) => `${h}${h === 15 ? "+" : ""} hrs a week`;

export function StepWhenWhere({ draft, update, onEdit }: Props) {
  const { tokens: { C } } = useTheme();
  const label = { color: C.white, fontFamily: FONT.bold, fontSize: fs(15) } as const;
  const row = { flexDirection: "row", flexWrap: "wrap", gap: s(8) } as const;

  return (
    <View style={{ gap: vs(20) }}>
      <Text accessibilityRole="header" style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22) }}>When and where?</Text>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Roughly how long?</Text>
        <View style={{ ...row, gap: s(10) }}>
          {DURATIONS.map((d) => (
            <Tile
              key={d.value}
              size="card"
              label={d.label}
              selected={draft.duration === d.value}
              onPress={() => update({ duration: d.value })}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Where will you work?</Text>
        <View style={row}>
          {COLLAB_STYLES.map((c) => (
            <Tile key={c} label={c} selected={draft.collabStyle === c} onPress={() => update({ collabStyle: c })} />
          ))}
        </View>
      </View>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Time each week</Text>
        <View style={row}>
          {COMMITMENT_HOURS.map((h) => (
            <Tile
              key={h}
              label={hoursLabel(h)}
              selected={draft.commitmentHours === h}
              onPress={() => update({ commitmentHours: h })}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Preview</Text>
        <ProjectSummaryCard
          title={draft.title.trim()}
          description={draft.description.trim()}
          timeframe={describeTimeframe({ duration: draft.duration, commitment_hours: draft.commitmentHours })}
          ownerName="You"
          ownerAvatarUrl={null}
        />
        <View style={{ ...row, gap: s(6) }}>
          {draft.roles.map((r) => (
            <View
              key={r}
              style={{ maxWidth: "100%", paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: s(12), backgroundColor: C.fieldBg, borderWidth: 1, borderColor: C.border }}
            >
              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12) }}>{r}</Text>
            </View>
          ))}
        </View>
        {draft.openToLearners ? (
          <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Open to learners</Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: s(20) }}>
          <Btn onPress={() => onEdit(2)} accessibilityLabel="Edit details" hitSlop={8}>
            <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Edit details</Text>
          </Btn>
          <Btn onPress={() => onEdit(3)} accessibilityLabel="Edit roles" hitSlop={8}>
            <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Edit roles</Text>
          </Btn>
        </View>
      </View>
    </View>
  );
}
