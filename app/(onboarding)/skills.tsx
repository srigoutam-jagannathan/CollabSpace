import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Palette, Code2, Briefcase, Trophy, Plus, ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { StepProgressBar } from "@/components/StepProgressBar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useEntrance } from "@/utils/useEntrance";
import { haptic } from "@/utils/haptics";

const SKILL_CATEGORIES = [
  {
    title: "CREATIVE AND ARTS",
    icon: Palette,
    skills: ["Design", "Visual Arts", "Film and Media", "Game", "Performing Arts", "Writing and Storytelling", "Music", "Animation"],
  },
  {
    title: "TECH AND DIGITAL",
    icon: Code2,
    skills: ["Coding and Development", "UI/UX", "Cybersecurity", "AI", "Data and Robotics", "VR/AR", "Blockchain"],
  },
  {
    title: "BUSINESS AND INNOVATION",
    icon: Briefcase,
    skills: ["Entrepreneurship", "Marketing", "Finance", "Social Media", "Content Creation"],
  },
  {
    title: "SPORTS AND LIFESTYLE",
    icon: Trophy,
    skills: ["Sports and Fitness", "Esports", "Travel and Adventure", "Cooking and Culinary Arts"],
  },
];

function SkillChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { tokens: { C } } = useTheme();
  return (
    <Btn onPress={onPress} pressScale={0.93}>
      <View style={{
        paddingHorizontal: s(14),
        paddingVertical: vs(8),
        borderRadius: s(20),
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? C.purpleL : C.borderSubtle,
        backgroundColor: selected ? "rgba(192,133,82,0.20)" : "rgba(255,248,240,0.04)",
      }}>
        <Text style={{ color: selected ? C.white : C.textMuted, fontFamily: selected ? FONT.bold : FONT.regular, fontSize: fs(13) }}>
          {label}
        </Text>
      </View>
    </Btn>
  );
}

export default function SkillsScreen() {
  const { tokens: { C } } = useTheme();
  const { user } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const anim = useEntrance(3, 100);

  // Badge opacity — fades in when ≥1 skill selected
  const [badgeOpacity] = useState(() => new Animated.Value(0));
  // CTA opacity — 0.45 when 0 selected, 1.0 when ≥1
  const [ctaOpacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const hasAny = selected.size > 0;
    Animated.timing(badgeOpacity, { toValue: hasAny ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(ctaOpacity, { toValue: hasAny ? 1 : 0.45, duration: 200, useNativeDriver: true }).start();
  }, [selected.size, badgeOpacity, ctaOpacity]);

  // Pre-load existing skills when editing from settings
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
        const presetSet = new Set(SKILL_CATEGORIES.flatMap((c) => c.skills));
        const custom = existing.filter((s) => !presetSet.has(s));
        setSelected(new Set(existing));
        if (custom.length) setCustomSkills(custom);
      });
  }, [user?.id]);

  function toggleSkill(skill: string) {
    haptic.light();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  }

  function addCustomSkill() {
    const trimmed = customInput.trim();
    if (!trimmed || customSkills.includes(trimmed) || selected.has(trimmed)) return;
    haptic.light();
    setCustomSkills((prev) => [...prev, trimmed]);
    setSelected((prev) => new Set([...prev, trimmed]));
    setCustomInput("");
  }

  async function handleSubmit() {
    const allSkills = Array.from(selected);
    const storageKey = user ? `skills_set_${user.id}` : "skills_set";

    if (!user) {
      await AsyncStorage.setItem(storageKey, "true");
      router.replace("/(app)/(tabs)");
      return;
    }

    setLoading(true);
    haptic.medium();
    try {
      const { error } = await supabase.from("profiles").upsert(
        { id: user.id, skills: allSkills, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (error) throw error;
      haptic.success();
      await AsyncStorage.setItem(storageKey, "true");
      if (from === "settings") {
        router.back();
      } else {
        router.replace("/(app)/(tabs)");
      }
    } catch {
      haptic.error();
      Alert.alert("Error", "Failed to save skills. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const ctaLabel = from === "settings" ? "Save" : "Continue →";

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Step bar */}
        <StepProgressBar step={2} />

        {/* Back */}
        {router.canGoBack() && (
          <Btn
            onPress={() => router.back()}
            pressScale={0.88}
            hitSlop={12}
            style={{ paddingLeft: s(20), paddingTop: vs(12), alignSelf: "flex-start" }}
          >
            <ChevronLeft size={s(24)} color={C.textMuted} strokeWidth={2} />
          </Btn>
        )}

        {/* [0] Header + floating badge */}
        <Animated.View style={[anim[0], { paddingHorizontal: s(28), paddingTop: vs(20), paddingBottom: vs(4) }]}>
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(32), lineHeight: vs(40) }}>
            What do you bring?
          </Text>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(15), marginTop: vs(8), lineHeight: vs(22) }}>
            Select skills that represent you. Add your own too.
          </Text>
          {/* Floating count badge */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: vs(20),
              right: s(28),
              opacity: badgeOpacity,
              backgroundColor: C.purple,
              borderRadius: s(20),
              paddingHorizontal: s(12),
              paddingVertical: vs(4),
            }}
          >
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12) }}>
              {selected.size} selected
            </Text>
          </Animated.View>
        </Animated.View>

        {/* [1] Skills scroll */}
        <Animated.View style={[anim[1], { flex: 1 }]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(120) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {SKILL_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <View key={category.title}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginTop: vs(24), marginBottom: vs(10) }}>
                    <CategoryIcon size={s(15)} color={C.purpleL} strokeWidth={2} />
                    <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12), letterSpacing: 0.8 }}>
                      {category.title}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
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
              );
            })}

            {/* Add your own */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginTop: vs(24), marginBottom: vs(10) }}>
                <Plus size={s(15)} color={C.purpleL} strokeWidth={2} />
                <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12), letterSpacing: 0.8 }}>
                  ADD YOUR OWN
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
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
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: `${C.borderBright}66`,
                  borderRadius: s(20),
                  paddingLeft: s(14),
                  paddingRight: s(6),
                  paddingVertical: vs(6),
                  backgroundColor: "rgba(255,248,240,0.04)",
                }}>
                  <TextInput
                    value={customInput}
                    onChangeText={setCustomInput}
                    onSubmitEditing={addCustomSkill}
                    placeholder="Add skill…"
                    placeholderTextColor={C.textMuted}
                    returnKeyType="done"
                    style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(13), minWidth: s(80), maxWidth: s(150), paddingVertical: 0 }}
                  />
                  {customInput.trim().length > 0 && (
                    <Btn onPress={addCustomSkill} pressScale={0.9} style={{ marginLeft: s(6) }}>
                      <View style={{
                        width: s(26), height: s(26), borderRadius: s(13),
                        backgroundColor: C.purpleL,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ color: C.bgDeep, fontFamily: FONT.bold, fontSize: fs(14), lineHeight: fs(16) }}>+</Text>
                      </View>
                    </Btn>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>

        {/* [2] Bottom CTA */}
        <Animated.View style={[anim[2], {
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.bgDeep,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingHorizontal: s(28),
          paddingTop: vs(16),
          paddingBottom: vs(36),
        }]}>
          <Animated.View style={{ opacity: ctaOpacity }}>
            <GradientBtn onPress={handleSubmit} loading={loading} label={ctaLabel} />
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
