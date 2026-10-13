import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { GradientBtn } from "@/components/GradientBtn";
import { Btn } from "@/components/Btn";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { describeTimeframe } from "@/utils/projectTimeframe";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { canonicalSkill } from "@/constants/skills";

type JoinProject = {
  id: string;
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  commitment_hours: number | null;
  owner_id: string;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  role_requirements: { role: string; description: string }[] | null;
  /** Legacy projects list roles here instead of role_requirements. */
  looking_for: string[] | null;
};

/**
 * The roles a joiner may ask for: the project's role_requirements, else its
 * legacy looking_for, else none. The database refuses any other role name.
 */
function projectRoles(project: JoinProject | null): string[] {
  if (!project) return [];
  const named = (Array.isArray(project.role_requirements) ? project.role_requirements : [])
    .map((r) => r?.role)
    .filter((role): role is string => typeof role === "string" && role.trim() !== "");
  if (named.length > 0) return [...new Set(named)];
  return [...new Set((project.looking_for ?? []).filter((role) => role.trim() !== ""))];
}

export default function JoinProjectScreen() {
  const { tokens: { C } } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<JoinProject | null>(null);
  const [projectError, setProjectError] = useState(false);
  const [mySkills, setMySkills] = useState<string[] | null>(null);
  const firstName = project?.owner?.full_name?.trim().split(/\s+/)[0] || "The owner";
  const roles = projectRoles(project);

  useEffect(() => {
    if (!id) return;
    setProject(null);
    setProjectError(false);
    let alive = true;
    supabase
      .from("projects")
      .select("id, title, description, start_date, end_date, commitment_hours, owner_id, role_requirements, looking_for, owner:profiles!owner_id(id, full_name, avatar_url)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setProjectError(true);
        else setProject(data as unknown as JoinProject);
      });
    return () => { alive = false; };
  }, [id]);

  // The viewer's skills, read alongside the project, to pre-pick a role.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("skills")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!alive) return;
        const skills = (data as { skills?: unknown } | null)?.skills;
        setMySkills(Array.isArray(skills) ? skills.filter((s): s is string => typeof s === "string") : []);
      });
    return () => { alive = false; };
  }, [userId]);

  // Pre-pick the first role matching one of the viewer's skills, but never
  // over a role they already tapped.
  const rolesKey = roles.join("\n");
  useEffect(() => {
    if (!mySkills || mySkills.length === 0 || !rolesKey) return;
    const mine = new Set(mySkills.map((s) => canonicalSkill(s).toLowerCase()));
    const match = rolesKey.split("\n").find((role) => mine.has(canonicalSkill(role).toLowerCase()));
    if (match) setSelectedRole((prev) => prev || match);
  }, [mySkills, rolesKey]);

  async function handleSubmit() {
    if (!user || !id) return;
    setLoading(true);

    const { error } = await supabase.from("project_members").insert({
      project_id: id,
      user_id: user.id,
      intro_message: message.trim() || null,
      // role is NOT NULL with a default of 'member'; send it only when picked.
      ...(selectedRole ? { role: selectedRole } : {}),
    });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already asked", "You've already asked to join this project.");
      } else if (error.code === "42501") {
        // The role check refused it: the owner changed the roles since this loaded.
        Alert.alert("That role isn't open", "The project's roles have changed. Pick another, or ask without a role.");
        setSelectedRole("");
      } else {
        Alert.alert("Error", error.message);
      }
      return;
    }

    Alert.alert(
      "Request sent",
      `${firstName} will review it. Once they approve, the project shows up in your Chats.`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(60) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: vs(16),
            marginBottom: vs(12),
          }}
        >
          <Text
            style={{
              color: C.white,
              fontFamily: FONT.bold,
              fontSize: fs(20),
            }}
          >
            Ask to join
          </Text>

          <Btn
            onPress={() => router.back()}
            hitSlop={12}
            pressScale={0.88}
            style={{ flexDirection: "row", alignItems: "center", gap: s(4) }}
          >
            <ChevronLeft size={s(18)} color={C.textMuted} />
            <Text
              style={{
                color: C.textMuted,
                fontFamily: FONT.medium,
                fontSize: fs(14),
              }}
            >
              Back
            </Text>
          </Btn>
        </View>

        {/* The project being joined; the form never waits for it */}
        <View style={{ marginBottom: vs(24) }}>
          {project ? (
            <ProjectSummaryCard
              title={project.title}
              description={project.description}
              timeframe={describeTimeframe(project)}
              ownerName={project.owner?.full_name ?? null}
              ownerAvatarUrl={project.owner?.avatar_url ?? null}
              onOwnerPress={project.owner
                ? () => router.push({ pathname: "/(app)/users/[id]", params: { id: project.owner_id } })
                : undefined}
            />
          ) : projectError ? (
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
              Couldn&apos;t load this project&apos;s details.
            </Text>
          ) : null}
        </View>

        {/* Role section: only the roles this project lists, if any */}
        {roles.length > 0 ? (
          <View style={{ marginBottom: vs(24) }}>
            <Text
              style={{
                color: C.white,
                fontFamily: FONT.semiBold,
                fontSize: fs(15),
                marginBottom: vs(10),
              }}
            >
              Role you&apos;d like
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: s(8) }}
            >
              {roles.map((role) => {
                const isSelected = selectedRole === role;
                return (
                  <Btn
                    key={role}
                    onPress={() => setSelectedRole(isSelected ? "" : role)}
                    pressScale={0.93}
                    style={{ marginRight: s(8) }}
                    accessibilityLabel={`Role ${role}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={{
                      borderRadius: s(20),
                      paddingHorizontal: s(16),
                      paddingVertical: vs(8),
                      backgroundColor: isSelected ? C.pink : "transparent",
                      borderWidth: 1.5,
                      borderColor: isSelected ? C.pink : C.border,
                    }}>
                      <Text style={{
                        color: isSelected ? C.white : C.textMuted,
                        fontFamily: isSelected ? FONT.semiBold : FONT.regular,
                        fontSize: fs(13),
                      }}>
                        {role}
                      </Text>
                    </View>
                  </Btn>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Intro message section */}
        <Text
          style={{
            color: C.white,
            fontFamily: FONT.semiBold,
            fontSize: fs(15),
            marginBottom: vs(10),
          }}
        >
          Intro Message
        </Text>

        <TextInput
          value={message}
          onChangeText={(t) => setMessage(t.slice(0, 500))}
          placeholder="Tell them why you're the right fit for this project…"
          placeholderTextColor={C.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            height: vs(140),
            backgroundColor: C.fieldBg,
            borderRadius: s(14),
            padding: s(16),
            color: C.white,
            fontSize: fs(14),
            fontFamily: FONT.regular,
            borderWidth: 1,
            borderColor: "rgba(192,133,82,0.22)",
          }}
        />

        <Text
          style={{
            color: C.textFaint,
            fontFamily: FONT.regular,
            fontSize: fs(11),
            textAlign: "right",
            marginTop: vs(6),
          }}
        >
          {message.length} / 500
        </Text>

        {selectedRole ? (
          <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13), marginTop: vs(20) }}>
            Applying as {selectedRole}
          </Text>
        ) : null}

        {/* Ask to join */}
        <View style={{ marginTop: vs(selectedRole ? 12 : 32) }}>
          <GradientBtn
            label="Ask to Join"
            onPress={handleSubmit}
            loading={loading}
            disabled={!message.trim() && !selectedRole}
          />
        </View>

        <Text style={{
          color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12),
          lineHeight: vs(18), textAlign: "center", marginTop: vs(12),
        }}>
          {firstName} will see your profile and message, and can approve you. Once they do,
          you&apos;re in the project chat.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
