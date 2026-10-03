import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { GradientBtn } from "@/components/GradientBtn";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { formatDateInput, ddmmyyyyToIso } from "@/utils/dateInput";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ["Academic Project", "Side Project", "Startup", "Community"];
const COLLAB_STYLES = ["Remote", "In-Person", "Hybrid"] as const;
type CollabStyle = typeof COLLAB_STYLES[number];

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderRadius: 10, borderWidth: 1, borderColor: C.borderSubtle }}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={{ paddingHorizontal: 16, paddingVertical: 10 }}
        hitSlop={8}
      >
        <Text style={{ color: C.purple, fontSize: 18, fontWeight: "700" }}>−</Text>
      </Pressable>
      <Text style={{ color: C.white, fontSize: 15, fontWeight: "600", minWidth: 28, textAlign: "center" }}>
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        style={{ paddingHorizontal: 16, paddingVertical: 10 }}
        hitSlop={8}
      >
        <Text style={{ color: C.purple, fontSize: 18, fontWeight: "700" }}>+</Text>
      </Pressable>
    </View>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label }: { label: string }) {
  const { tokens: { C } } = useTheme();
  return (
    <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(10) }}>
      {label}
    </Text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateProject() {
  const { tokens: { C } } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [skillsInput, setSkillsInput] = useState("");
  const [collabStyle, setCollabStyle] = useState<CollabStyle>("Hybrid");
  const [teamSize, setTeamSize] = useState(0);
  const [commitmentHours, setCommitmentHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ownerRole, setOwnerRole] = useState("");
  const [roleRequirements, setRoleRequirements] = useState<{ role: string; description: string }[]>([]);
  const [newRole, setNewRole] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const isValid = title.trim().length >= 3 && description.trim().length >= 20;

  function addRoleRequirement() {
    if (!newRole.trim()) return;
    setRoleRequirements(prev => [...prev, { role: newRole.trim(), description: newRoleDesc.trim() }]);
    setNewRole("");
    setNewRoleDesc("");
  }
  function removeRoleRequirement(index: number) {
    setRoleRequirements(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!user || !isValid) return;
    const startIso = startDate ? ddmmyyyyToIso(startDate) : null;
    const endIso = endDate ? ddmmyyyyToIso(endDate) : null;
    if ((startDate && !startIso) || (endDate && !endIso)) {
      Alert.alert("Check the dates", "Enter each date as DD/MM/YYYY, e.g. 03/10/2026.");
      return;
    }
    setLoading(true);

    const tags = skillsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { data, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        looking_for: [],
        tags,
        university_scope: "both",
        status: "recruiting",
        project_type: projectType,
        collaboration_style: collabStyle,
        team_size: teamSize,
        commitment_hours: commitmentHours,
        start_date: startIso,
        end_date: endIso,
        owner_role: ownerRole.trim() || null,
        role_requirements: roleRequirements,
      })
      .select()
      .single();

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
        role: ownerRole.trim() || "owner",
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
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(12), gap: s(10) }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.textMuted, fontSize: fs(20) }}>‹</Text>
        </Pressable>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(20) }}>Create Project</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(60) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Project Title */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Project Title" />
          <TextInput
            style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)" }}
            placeholder="e.g. Mental Health Journaling App"
            placeholderTextColor={C.textFaint}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            returnKeyType="next"
          />
        </View>

        {/* Project Duration */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Project Duration" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 6 }}>Start Date</Text>
              <TextInput
                style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)" }}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={C.textFaint}
                value={startDate}
                onChangeText={(t) => setStartDate((prev) => formatDateInput(t, prev))}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 6 }}>End Date</Text>
              <TextInput
                style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)" }}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={C.textFaint}
                value={endDate}
                onChangeText={(t) => setEndDate((prev) => formatDateInput(t, prev))}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Description" />
          <TextInput
            style={{ backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: C.borderSubtle }}
            placeholder="Describe your project..."
            placeholderTextColor={C.textFaint}
            multiline
            value={description}
            onChangeText={setDescription}
          />
          <Text style={{ color: C.textFaint, fontSize: 11, marginTop: 4 }}>
            {description.trim().length} chars (20 min)
          </Text>
        </View>

        {/* Project Type */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Project Type:" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PROJECT_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setProjectType(type)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: projectType === type ? C.pink : C.border,
                  backgroundColor: projectType === type ? C.pink : C.fieldBg,
                }}
              >
                <Text style={{ color: projectType === type ? C.white : C.textMuted, fontSize: 13 }}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Skills Needed */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Skills Needed" />
          <TextInput
            style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)" }}
            placeholder="e.g. Design, React Native, Marketing"
            placeholderTextColor={C.textFaint}
            value={skillsInput}
            onChangeText={setSkillsInput}
          />
        </View>

        {/* Owner Role */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Your Role in This Project" />
          <TextInput
            style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)" }}
            placeholder="e.g. Project Lead, Developer, Designer"
            placeholderTextColor={C.textFaint}
            value={ownerRole}
            onChangeText={setOwnerRole}
            maxLength={60}
          />
        </View>

        {/* Role Requirements */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Roles Needed" />
          {/* Existing role requirements */}
          {roleRequirements.map((req, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: C.fieldBg, borderRadius: 12, padding: 12, marginBottom: 8, gap: 8, borderWidth: 1, borderColor: "rgba(192,133,82,0.20)" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.purple, fontWeight: "700", fontSize: 13 }}>{req.role}</Text>
                {req.description ? <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{req.description}</Text> : null}
              </View>
              <Pressable onPress={() => removeRoleRequirement(i)} hitSlop={8}>
                <Text style={{ color: "rgba(248,113,113,0.8)", fontSize: 18, lineHeight: 22 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {/* Add new role */}
          <TextInput
            style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.white, fontSize: 13, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)", marginBottom: 8 }}
            placeholder="Role title (e.g. Frontend Developer)"
            placeholderTextColor={C.textFaint}
            value={newRole}
            onChangeText={setNewRole}
            maxLength={50}
          />
          <TextInput
            style={{ backgroundColor: C.fieldBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.white, fontSize: 13, borderWidth: 1, borderColor: "rgba(192,133,82,0.30)", marginBottom: 8 }}
            placeholder="What will this person do? (optional)"
            placeholderTextColor={C.textFaint}
            value={newRoleDesc}
            onChangeText={setNewRoleDesc}
            maxLength={200}
          />
          <Pressable
            onPress={addRoleRequirement}
            style={{ backgroundColor: newRole.trim() ? "rgba(192,133,82,0.30)" : C.fieldBg, borderRadius: s(14), paddingVertical: vs(12), alignItems: "center", borderWidth: 1, borderColor: newRole.trim() ? C.purple : C.border }}
          >
            <Text style={{ color: newRole.trim() ? C.white : C.textFaint, fontSize: 13, fontWeight: "600" }}>+ Add Role</Text>
          </Pressable>
        </View>

        {/* Collaboration Style */}
        <View style={{ marginBottom: 24 }}>
          <FieldLabel label="Collaboration Style:" />
          <View style={{ flexDirection: "row", gap: 16 }}>
            {COLLAB_STYLES.map((style) => (
              <Pressable
                key={style}
                onPress={() => setCollabStyle(style)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 2,
                  borderColor: collabStyle === style ? C.pink : C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {collabStyle === style && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink }} />
                  )}
                </View>
                <Text style={{ color: C.white, fontSize: 14 }}>{style}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Team Size */}
        <View style={{ marginBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <FieldLabel label="Team Size:" />
          <Stepper value={teamSize} onChange={setTeamSize} min={0} />
        </View>

        {/* Commitment */}
        <View style={{ marginBottom: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <FieldLabel label="Commitment time (per week):" />
          <Stepper value={commitmentHours} onChange={setCommitmentHours} min={0} />
        </View>

        {!isValid && (
          <Text style={{ color: C.textMuted, fontSize: 12, textAlign: "center", marginBottom: 10 }}>
            {title.trim().length < 3 ? "Title must be at least 3 characters" : `Description needs ${20 - description.trim().length} more characters`}
          </Text>
        )}
        <GradientBtn onPress={handleSubmit} loading={loading} disabled={!isValid} label="Post Now" />
      </ScrollView>
    </SafeAreaView>
  );
}
