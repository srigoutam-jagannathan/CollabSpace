import { useRef } from "react";
import { View, Text, TextInput } from "react-native";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { vs, fs } from "@/utils/scale";
import { MIN_DESCRIPTION, MIN_TITLE, stepReady, type ProjectDraft } from "./draft";

interface Props {
  draft: ProjectDraft;
  update: (patch: Partial<ProjectDraft>) => void;
  /** Set after a Next that the step wasn't ready for. */
  showErrors: boolean;
}

export function StepDetails({ draft, update, showErrors }: Props) {
  const { tokens: { C } } = useTheme();
  const descriptionRef = useRef<TextInput>(null);
  const input = {
    backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: C.white, fontSize: fs(14), fontFamily: FONT.regular,
    borderWidth: 1, borderColor: "rgba(192,133,82,0.30)",
  } as const;
  const descLength = draft.description.trim().length;
  const error = showErrors && !stepReady(2, draft)
    ? draft.title.trim().length < MIN_TITLE
      ? `Title must be at least ${MIN_TITLE} characters`
      : `Description needs ${MIN_DESCRIPTION - descLength} more characters`
    : null;

  return (
    <View style={{ gap: vs(16) }}>
      <View style={{ gap: vs(6) }}>
        <Text accessibilityRole="header" style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22) }}>Name it and describe it</Text>
        <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
          The only typing there is. A sentence or two is plenty.
        </Text>
      </View>
      <TextInput
        style={input}
        placeholder="e.g. Mental Health Journaling App"
        placeholderTextColor={C.textFaint}
        value={draft.title}
        onChangeText={(title) => update({ title })}
        maxLength={80}
        returnKeyType="next"
        // Next moves to the description without dropping the keyboard.
        submitBehavior="submit"
        onSubmitEditing={() => descriptionRef.current?.focus()}
        accessibilityLabel="Project title"
      />
      <View style={{ gap: vs(6) }}>
        <TextInput
          ref={descriptionRef}
          style={{ ...input, minHeight: vs(140), textAlignVertical: "top" }}
          placeholder="What is it, and what will the team do?"
          placeholderTextColor={C.textFaint}
          multiline
          value={draft.description}
          onChangeText={(description) => update({ description })}
          accessibilityLabel="Project description"
        />
        <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11) }}>
          {descLength} / {MIN_DESCRIPTION} characters minimum
        </Text>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12) }}>{error}</Text>
      ) : null}
    </View>
  );
}
