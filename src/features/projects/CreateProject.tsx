import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform, AccessibilityInfo } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
// expo-router vendors React Navigation; this is its copy, the one the router's stack uses.
import { usePreventRemove } from "expo-router/react-navigation";
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
  const navigation = useNavigation();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  // Set once leaving is decided (Discard, or a successful post), so the guard below lets
  // the navigation through. A ref, because router.replace fires before any re-render.
  const leaving = useRef(false);

  const update = (patch: Partial<ProjectDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = draft.projectType !== null || draft.title !== "" || draft.description !== "" || draft.roles.length > 0;

  // Screen readers hear each step change; the first step is the screen opening, so skip it.
  const announcedStep = useRef(step);
  useEffect(() => {
    if (announcedStep.current === step) return;
    announcedStep.current = step;
    AccessibilityInfo.announceForAccessibility(`Step ${step} of 4`);
  }, [step]);

  function goTo(target: Step) {
    setShowErrors(false);
    setStep(target);
  }

  /** Back one step, or out of the flow from step 1, asking first if that loses a draft. */
  function back(leave: () => void) {
    if (step > 1) { goTo((step - 1) as Step); return; }
    if (!dirty) { leave(); return; }
    Alert.alert("Discard this project?", "You'll lose what you've entered.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { leaving.current = true; leave(); } },
    ]);
  }

  // iOS swipe-back and Android's back button leave the whole screen; send them through back().
  usePreventRemove(step > 1 || dirty, ({ data }) => {
    if (leaving.current) navigation.dispatch(data.action);
    else back(() => navigation.dispatch(data.action));
  });

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

    leaving.current = true;
    router.replace({ pathname: "/(app)/projects/[id]/preview", params: { id: data.id } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(12), gap: vs(12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
          {/* Not keyed by step: Btn's debounce must span steps, so a double tap goes back one. */}
          <Btn onPress={() => back(() => router.back())} accessibilityLabel="Back" hitSlop={12}>
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

      {/* The footer sits below the ScrollView, not over it, so the keyboard pushes it up on iOS. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(24) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
            style={{
              padding: s(20), paddingBottom: vs(20) + insets.bottom,
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
