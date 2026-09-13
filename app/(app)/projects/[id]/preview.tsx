import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { GradientBtn } from "@/components/GradientBtn";
import { QuitProjectSheet } from "@/components/QuitProjectSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import type { Project } from "@/types/database";

export default function ProjectPreviewScreen() {
  const { tokens: { C, GRADIENT, GLASS } } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [quitSheetVisible, setQuitSheetVisible] = useState(false);
  const [myFullName, setMyFullName] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: membership }, { data: profileData }] = await Promise.all([
        supabase.from("projects").select("*, owner:profiles!owner_id(full_name)").eq("id", id).single(),
        supabase
          .from("project_members")
          .select("id")
          .eq("project_id", id)
          .eq("user_id", user?.id ?? "")
          .maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").single(),
      ]);
      // Flatten owner_name
      if (proj && (proj as any).owner) {
        (proj as any).owner_name = (proj as any).owner.full_name;
      }
      setProject(proj);
      setIsMember(!!membership);
      if (profileData) setMyFullName(profileData.full_name ?? "");
      setLoading(false);
    }
    load();
  }, [id, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <Text style={{ color: C.white, textAlign: "center", marginTop: vs(60) }}>Project not found.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = project.owner_id === user?.id;

  async function handleQuit() {
    if (!user || !project) return;
    await supabase.from("project_members").delete()
      .eq("project_id", id).eq("user_id", user.id);
    await supabase.from("collaboration_events").insert({
      project_id: id, user_id: user.id, event_type: "member_quit",
    });
    await supabase.from("chat_messages").insert({
      project_id: id, sender_id: user.id,
      type: "member_left", content: "",
      metadata: { userName: myFullName || "A user" },
      read_by: [],
    });
    await supabase.functions.invoke("notify-owner", {
      body: {
        projectId: id,
        title: `${myFullName || "A member"} left ${project.title}`,
        body: `${myFullName || "A member"} has left the project.`,
      },
    });
    router.replace("/(app)/projects" as any);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(20), paddingVertical: vs(12) }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center" }} hitSlop={12}>
          <ChevronLeft size={s(18)} color={C.textMuted} />
          <Text style={{ color: C.textMuted, fontSize: fs(14) }}>Back</Text>
        </Pressable>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(17) }}>Preview Project</Text>
        <View style={{ width: s(60) }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: s(20), paddingBottom: vs(120) }} showsVerticalScrollIndicator={false}>
        {/* Project card — glass with gradient strip */}
        <View style={{ backgroundColor: GLASS.card.backgroundColor, borderWidth: 1, borderColor: GLASS.card.borderColor, borderRadius: s(20), overflow: "hidden", marginBottom: vs(20) }}>
          <LinearGradient
            colors={GRADIENT.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: vs(4) }}
          />
          <View style={{ padding: s(20) }}>
            <Text style={{ color: C.white, fontWeight: "800", fontSize: fs(22), marginBottom: vs(8) }}>
              {project.title}
            </Text>
            <Text style={{ color: C.textMuted, fontSize: fs(14), lineHeight: vs(21) }}>
              {project.description}
            </Text>
          </View>
        </View>

        {/* Looking for */}
        {project.looking_for?.length > 0 && (
          <View style={{ marginBottom: vs(20) }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(10) }}>Looking For</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
              {project.looking_for.map((role: string) => (
                <View key={role} style={{ backgroundColor: C.surface, borderRadius: s(20), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: C.borderBright }}>
                  <Text style={{ color: C.purpleL, fontSize: fs(13) }}>{role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tags */}
        {project.tags?.length > 0 && (
          <View style={{ marginBottom: vs(20) }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(10) }}>Tags</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
              {project.tags.map((tag: string) => (
                <View key={tag} style={{ borderWidth: 1, borderColor: C.border, borderRadius: s(20), paddingHorizontal: s(12), paddingVertical: vs(5) }}>
                  <Text style={{ color: C.textMuted, fontSize: fs(12) }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Owner info */}
        <View style={{ marginBottom: vs(20) }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(10) }}>Project Owner</Text>
          <View style={{ backgroundColor: C.surface, borderRadius: s(14), borderWidth: 1, borderColor: C.border, padding: s(14), flexDirection: "row", alignItems: "center", gap: s(12) }}>
            <View style={{ width: s(42), height: s(42), borderRadius: s(21), backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(14) }}>
                {(project as any).owner_name ? (project as any).owner_name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() : "O"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14) }}>{(project as any).owner_name ?? "Project Owner"}</Text>
              {(project as any).owner_role ? (
                <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(75,46,43,0.10)", borderWidth: 1, borderColor: "rgba(192,133,82,0.20)", borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: vs(3), marginTop: vs(4) }}>
                  <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(11) }}>{(project as any).owner_role}</Text>
                </View>
              ) : (
                <View style={{ alignSelf: "flex-start", backgroundColor: C.purple, borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: vs(3), marginTop: vs(4) }}>
                  <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(11) }}>Owner</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Role requirements */}
        {((project as any).role_requirements?.length > 0) && (
          <View style={{ marginBottom: vs(20) }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(15), marginBottom: vs(10) }}>Role Requirements</Text>
            <View style={{ gap: vs(8) }}>
              {((project as any).role_requirements as { role: string; description: string }[]).map((req, i) => (
                <View key={i} style={{ backgroundColor: C.surface, borderRadius: s(14), borderWidth: 1, borderColor: C.border, padding: s(14) }}>
                  <View style={{ backgroundColor: "rgba(75,46,43,0.10)", borderWidth: 1, borderColor: "rgba(192,133,82,0.20)", alignSelf: "flex-start", borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: vs(3), marginBottom: vs(6) }}>
                    <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(12) }}>{req.role}</Text>
                  </View>
                  {req.description ? (
                    <Text style={{ color: C.textMuted, fontSize: fs(13), lineHeight: vs(19) }}>{req.description}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: s(20), paddingBottom: vs(32), gap: vs(10),
        backgroundColor: C.modalBg,
        borderTopWidth: 1, borderTopColor: C.border,
      }}>
        {isOwner ? (
          <GradientBtn
            onPress={() => router.push({ pathname: "/(app)/projects/[id]/insights", params: { id } })}
            label="✦  View AI Insights"
          />
        ) : isMember ? (
          <>
            <GradientBtn
              onPress={() => router.push({ pathname: "/(app)/chat/[id]", params: { id } })}
              label="Open Chat"
            />
            <Pressable
              onPress={() => setQuitSheetVisible(true)}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: pressed ? C.danger : "rgba(248,113,113,0.35)",
                borderRadius: s(14),
                paddingVertical: vs(14),
                alignItems: "center",
                backgroundColor: pressed ? "rgba(248,113,113,0.08)" : "transparent",
              })}
            >
              <Text style={{ color: C.danger, fontSize: fs(14), fontWeight: "500" }}>
                Leave Project
              </Text>
            </Pressable>
            <QuitProjectSheet
              visible={quitSheetVisible}
              projectTitle={project.title}
              onClose={() => setQuitSheetVisible(false)}
              onQuit={handleQuit}
            />
          </>
        ) : (
          <GradientBtn
            onPress={() => router.push({ pathname: "/(app)/projects/[id]/join", params: { id } })}
            label="Join Project"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
