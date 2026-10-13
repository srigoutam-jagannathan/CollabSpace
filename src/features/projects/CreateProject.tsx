import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { EMPTY_DRAFT, buildProjectInsert, stepReady, type ProjectDraft, type Step } from "./create/draft";
import { StepType } from "./create/StepType";
import { StepDetails } from "./create/StepDetails";
import { StepRoles } from "./create/StepRoles";
import { StepWhenWhere } from "./create/StepWhenWhere";

const STEPS: Step[] = [1, 2, 3, 4];

/**
 * Create Project in four short steps: type, details, roles, when and where (with
 * a preview). Only the title and description are typed. The draft lives here, so
 * Back and the preview's Edit links never lose anything.
 */
export default function CreateProject() {
  const { tokens: { C } } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const update = (patch: Partial<ProjectDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function goTo(target: Step) {
    setShowErrors(false);
    setStep(target);
  }

  function back() {
    if (step === 1) router.back();
    else goTo((step - 1) as Step);
  }

  function next() {
    if (!stepReady(step, draft)) { setShowErrors(true); return; }
    goTo((step + 1) as Step);
  }

  async function post() {
    if (!user || loading || !stepReady(4, draft)) return;
    setLoading(true);
    const { data, error } = await supabase.from("projects").insert(buildProjectInsert(draft, user.id)).select().single();
    setLoading(false);

    if (error) {
      console.error("[CreateProject] insert error:", error);
      Alert.alert("Could not create project", error.message);
      return;
    }

    if (!data?.id) {
      Alert.alert("Error", "Project created but no ID returned.");
      return;
    }

    // Add owner to project_members so the group chat is immediately visible
    const { error: memberError } = await supabase
      .from("project_members")
      .insert({
        project_id: data.id,
        user_id: user.id,
        role: draft.ownerRole.trim() || "owner",
        // Allowed because they own the project (guard_member_status).
        status: "approved",
        mou_accepted: true,
        mou_accepted_at: new Date().toISOString(),
      });
    if (memberError) {
      console.warn("[CreateProject] owner member insert failed:", memberError);
    }

    router.replace({ pathname: "/(app)/projects/[id]/preview", params: { id: data.id } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(12), gap: vs(12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
          {/* Keyed by step so a quick double tap isn't swallowed by Btn's debounce across steps,
              while a double tap on step 1 still leaves only once. */}
          <Btn key={step} onPress={back} accessibilityLabel="Back" hitSlop={12}>
            <ChevronLeft size={s(24)} color={C.textMuted} />
          </Btn>
          <Text style={{ flex: 1, color: C.white, fontFamily: FONT.bold, fontSize: fs(18) }}>Create project</Text>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12) }}>Step {step} of 4</Text>
        </View>
        <View style={{ flexDirection: "row", gap: s(6) }}>
          {STEPS.map((n) => (
            <View key={n} style={{ flex: 1, height: vs(4), borderRadius: 2, backgroundColor: n <= step ? C.pink : C.border }} />
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: (step === 1 ? 0 : footerHeight) + vs(24) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <StepType draft={draft} update={update} onPick={(value) => { update({ projectType: value }); goTo(2); }} />
        ) : step === 2 ? (
          <StepDetails draft={draft} update={update} showErrors={showErrors} />
        ) : step === 3 ? (
          <StepRoles draft={draft} update={update} />
        ) : (
          <StepWhenWhere draft={draft} update={update} onEdit={goTo} />
        )}
      </ScrollView>

      {step > 1 ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: s(20), paddingBottom: vs(20),
            backgroundColor: C.modalBg,
            borderTopWidth: 1, borderTopColor: C.border,
          }}
        >
          {step === 4 ? (
            <GradientBtn label="Post project" onPress={post} loading={loading} disabled={!stepReady(4, draft)} />
          ) : (
            // Keyed so step 3's Next is a fresh button, not one still inside step 2's debounce.
            // Step 2 stays pressable so a too-short title or description can say why.
            <GradientBtn key={step} label="Next" onPress={next} disabled={step === 3 && !stepReady(3, draft)} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
