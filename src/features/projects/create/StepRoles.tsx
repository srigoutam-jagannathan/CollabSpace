import { useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { Btn } from "@/components/Btn";
import { ALL_SKILLS } from "@/constants/skills";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { Tile } from "./Tile";
import { addRole, type ProjectDraft } from "./draft";

interface Props {
  draft: ProjectDraft;
  update: (patch: Partial<ProjectDraft>) => void;
}

const OWNER_ROLES = ["Project Lead", ...ALL_SKILLS];

export function StepRoles({ draft, update }: Props) {
  const { tokens: { C } } = useTheme();
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");

  const presets: readonly string[] = ALL_SKILLS;
  const customRoles = draft.roles.filter((r) => !presets.includes(r));
  const name = custom.trim();

  function toggle(role: string) {
    update({ roles: draft.roles.includes(role) ? draft.roles.filter((r) => r !== role) : addRole(draft.roles, role) });
  }

  function addCustom() {
    if (!name) return;
    // "design" typed by hand is the Design tile, not a second chip.
    const preset = presets.find((p) => p.toLowerCase() === name.toLowerCase());
    update({ roles: addRole(draft.roles, preset ?? name) });
    setCustom("");
    setAdding(false);
  }

  const label = { color: C.white, fontFamily: FONT.bold, fontSize: fs(15) } as const;

  return (
    <View style={{ gap: vs(20) }}>
      <View style={{ gap: vs(6) }}>
        <Text accessibilityRole="header" style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22) }}>Who do you need?</Text>
        <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>Tap every role you&apos;re looking for.</Text>
      </View>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Roles you need</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
          {[...presets, ...customRoles].map((skill) => (
            <Tile
              key={skill}
              label={skill}
              accessibilityLabel={`Need ${skill}`}
              selected={draft.roles.includes(skill)}
              onPress={() => toggle(skill)}
            />
          ))}
        </View>

        {adding ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                color: C.white, fontSize: fs(13), fontFamily: FONT.regular,
                borderWidth: 1, borderColor: "rgba(192,133,82,0.30)",
              }}
              placeholder="e.g. Beekeeper"
              placeholderTextColor={C.textFaint}
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
              maxLength={50}
              autoFocus
              returnKeyType="done"
            />
            <Btn
              onPress={addCustom}
              disabled={!name}
              accessibilityLabel={`Add ${name}`}
              style={{ paddingHorizontal: s(16), paddingVertical: vs(10), borderRadius: s(12), backgroundColor: C.pink }}
            >
              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Add</Text>
            </Btn>
          </View>
        ) : (
          <Btn
            onPress={() => setAdding(true)}
            accessibilityLabel="Add a role that isn't listed"
            hitSlop={8}
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(13) }}>+ Something else</Text>
          </Btn>
        )}
      </View>

      <View style={{ gap: vs(10) }}>
        <Text style={label}>Your role (optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: s(8) }}
        >
          {OWNER_ROLES.map((r) => (
            <Tile
              key={r}
              label={r}
              accessibilityLabel={`Your role ${r}`}
              selected={draft.ownerRole === r}
              onPress={() => update({ ownerRole: draft.ownerRole === r ? "" : r })}
            />
          ))}
        </ScrollView>
      </View>

      <Tile
        size="full"
        isSwitch
        label="Open to learners"
        hint="Welcome people who want to learn these skills, not just people who have them"
        selected={draft.openToLearners}
        onPress={() => update({ openToLearners: !draft.openToLearners })}
      />
    </View>
  );
}
