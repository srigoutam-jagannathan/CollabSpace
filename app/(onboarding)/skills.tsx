import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

// ─── Skill data ───────────────────────────────────────────────────────────────

const SKILL_CATEGORIES = [
  {
    title: "Creative and Arts",
    skills: [
      "Design", "Visual Arts", "Film and Media", "Game",
      "Performing Arts", "Writing and Storytelling", "Music", "Animation",
    ],
  },
  {
    title: "Tech and Digital",
    skills: [
      "Coding and Development", "Ui/Ux", "Cybersecurity",
      "Ai", "Data and Robotics", "VR/AR", "Blockchain",
    ],
  },
  {
    title: "Business and Innovation",
    skills: [
      "Entrepreneurship", "Marketing", "Finance", "Social Media", "Content Creation",
    ],
  },
  {
    title: "Sports and Lifestyle",
    skills: [
      "Sports and Fitness", "Esports", "Travel and Adventure", "Cooking and Culinary Arts",
    ],
  },
];

// ─── Chip ─────────────────────────────────────────────────────────────────────

function SkillChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Btn
      onPress={onPress}
      pressScale={0.93}
      style={{ marginBottom: vs(8), marginRight: s(8) }}
    >
      <View
        style={{
          paddingHorizontal: s(16),
          paddingVertical: vs(9),
          borderRadius: s(20),
          borderWidth: 1.5,
          borderColor: selected ? "#FFD1E3" : "rgba(255,255,255,0.35)",
          backgroundColor: selected ? "#FFD1E3" : "rgba(255,255,255,0.08)",
        }}
      >
        <Text style={{ color: selected ? "#1a0a2e" : "#ffffff", fontWeight: selected ? "700" : "400", fontSize: fs(13) }}>
          {label}
        </Text>
      </View>
    </Btn>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SkillsScreen() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Pre-load existing skills so editing from profile preserves previous picks
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("skills")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data?.skills?.length) return;
        const existing: string[] = data.skills;
        // Separate known preset skills from custom ones
        const presetSet = new Set(
          SKILL_CATEGORIES.flatMap((c) => c.skills)
        );
        const custom = existing.filter((s) => !presetSet.has(s));
        setSelected(new Set(existing));
        if (custom.length) setCustomSkills(custom);
      });
  }, [user?.id]);

  function toggleSkill(skill: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  }

  function addCustomSkill() {
    const trimmed = customInput.trim();
    if (!trimmed || customSkills.includes(trimmed) || selected.has(trimmed)) return;
    setCustomSkills((prev) => [...prev, trimmed]);
    setSelected((prev) => new Set([...prev, trimmed]));
    setCustomInput("");
  }

  async function handleSubmit() {
    const allSkills = Array.from(selected);
    const storageKey = user ? `skills_set_${user.id}` : "skills_set";

    // For dev bypass (no real user) just skip to app
    if (!user) {
      await AsyncStorage.setItem(storageKey, "true");
      router.replace("/(app)/");
      return;
    }

    setLoading(true);
    try {
      // Upsert so it works whether the profile row exists or not
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          skills: allSkills,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      await AsyncStorage.setItem(storageKey, "true");
      // If opened from within the app (e.g. profile edit), go back.
      // Otherwise it's first-time onboarding — go to home.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(app)/");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save skills. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    const storageKey = user ? `skills_set_${user.id}` : "skills_set";
    await AsyncStorage.setItem(storageKey, "true");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Back to Profile */}
      {router.canGoBack() && (
        <Btn
          onPress={() => router.back()}
          style={{ position: "absolute", top: vs(56), left: s(24), zIndex: 10 }}
          hitSlop={16}
          pressScale={0.9}
        >
          <Text style={{ color: C.textMuted, fontSize: fs(16) }}>‹ Back</Text>
        </Btn>
      )}

      {/* Skip */}
      <Btn
        onPress={handleSkip}
        style={{ position: "absolute", top: vs(56), right: s(24), zIndex: 10 }}
        hitSlop={16}
        pressScale={0.9}
      >
        <Text style={{ color: C.textMuted, fontSize: fs(16) }}>Skip</Text>
      </Btn>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: vs(80), paddingHorizontal: s(24), paddingBottom: vs(140) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: C.white, fontWeight: "800", fontSize: fs(28), marginBottom: vs(6) }}>
          Add Skills and Interests.
        </Text>
        <Text style={{ color: C.textMuted, fontSize: fs(15), marginBottom: vs(32) }}>
          What skills and interests can you bring to the table?
        </Text>

        {SKILL_CATEGORIES.map((category) => (
          <View key={category.title} style={{ marginBottom: vs(32) }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(14) }}>
              {category.title}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {category.skills.map((skill) => (
                <SkillChip
                  key={skill}
                  label={skill}
                  selected={selected.has(skill)}
                  onPress={() => toggleSkill(skill)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Others — custom skill input */}
        <View style={{ marginBottom: vs(16) }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(12) }}>
            Others
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {customSkills.map((skill) => (
              <SkillChip
                key={skill}
                label={skill}
                selected={selected.has(skill)}
                onPress={() => toggleSkill(skill)}
              />
            ))}

            {/* Input chip */}
            <View style={{
              flexDirection: "row", alignItems: "center",
              borderWidth: 1, borderColor: C.border,
              borderRadius: s(20), paddingLeft: s(14), paddingRight: s(6),
              paddingVertical: vs(4), marginBottom: vs(6), marginRight: s(6),
              backgroundColor: "rgba(255,255,255,0.05)",
            }}>
              <TextInput
                value={customInput}
                onChangeText={setCustomInput}
                onSubmitEditing={addCustomSkill}
                placeholder="Add Your Own..."
                placeholderTextColor={C.textFaint}
                returnKeyType="done"
                style={{ color: C.white, fontSize: fs(13), minWidth: s(100), maxWidth: s(160), paddingVertical: vs(4) }}
              />
              {customInput.trim().length > 0 && (
                <Btn
                  onPress={addCustomSkill}
                  pressScale={0.9}
                  style={{ backgroundColor: C.pink, borderRadius: s(14), paddingHorizontal: s(10), paddingVertical: vs(4), marginLeft: s(4) }}
                >
                  <Text style={{ color: C.white, fontSize: fs(12), fontWeight: "700" }}>+</Text>
                </Btn>
              )}
            </View>
          </View>
        </View>

        {selected.size > 0 && (
          <Text style={{ color: C.textFaint, fontSize: fs(12), marginTop: vs(8) }}>
            {selected.size} skill{selected.size === 1 ? "" : "s"} selected
          </Text>
        )}
      </ScrollView>

      {/* Fixed Submit */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingHorizontal: s(24), paddingBottom: vs(40), paddingTop: vs(16),
        backgroundColor: "rgba(8,0,20,0.95)",
        borderTopWidth: 1, borderTopColor: C.border,
      }}>
        <GradientBtn onPress={handleSubmit} loading={loading} label="Submit" />
      </View>
    </KeyboardAvoidingView>
  );
}
