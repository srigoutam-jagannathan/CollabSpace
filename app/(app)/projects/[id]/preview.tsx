import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
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
import { describeTimeframe } from "@/utils/projectTimeframe";
import type { Project } from "@/types/database";
import { ScreenLoader } from "@/components/ScreenLoader";
import { DangerBtn } from "@/components/DangerBtn";

export default function ProjectPreviewScreen() {
  const { tokens: { C, GRADIENT, GLASS } } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [footerHeight, setFooterHeight] = useState(0);
  const goBack = () => router.back();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [quitSheetVisible, setQuitSheetVisible] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: membership }] = await Promise.all([
        supabase.from("projects").select("*, owner:profiles!owner_id(full_name)").eq("id", id).single(),
        supabase
          .from("project_members")
          .select("id")
          .eq("project_id", id)
          .eq("user_id", user?.id ?? "")
          .maybeSingle(),
      ]);
      // Flatten owner_name
      if (proj && (proj as any).owner) {
        (proj as any).owner_name = (proj as any).owner.full_name;
      }
      setProject(proj);
      setIsMember(!!membership);
      setLoading(false);
    }
    load();
  }, [id, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <ScreenLoader />
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
  const timeframe = describeTimeframe(project);

  async function handleQuit() {
    if (!user || !project) return;
    try {
      // One transaction, server-side: deletes the membership row, logs
      // member_quit and posts the member_left chat message.
      const { error } = await supabase.rpc("leave_project", { p_project: id });
      if (error) throw error;
      // The function builds the recipient and the text from the database.
      await supabase.functions.invoke("notify-owner", { body: { projectId: id } });
      router.replace("/(app)/projects" as any);
    } catch {
      Alert.alert("Error", "Could not leave the project. Please try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(20), paddingVertical: vs(12) }}>
        <Pressable onPress={goBack} style={{ flexDirection: "row", alignItems: "center" }} hitSlop={12}>
          <ChevronLeft size={s(18)} color={C.textMuted} />
          <Text style={{ color: C.textMuted, fontSize: fs(14) }}>Back</Text>
        </Pressable>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(17) }}>Preview Project</Text>
        <View style={{ width: s(60) }} />
      </View>

      <ScrollView
        // The action bar is absolutely positioned over the scroll view, and its
        // height depends on whether it holds one button or two. Measure it
        // rather than reserving a fixed gap that only fits one of those cases.
        contentContainerStyle={{ padding: s(20), paddingBottom: footerHeight + vs(24) }}
        showsVerticalScrollIndicator={false}
      >
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
            {timeframe ? (
              <Text style={{ color: C.purpleL, fontSize: fs(13), marginTop: vs(10) }}>{timeframe}</Text>
            ) : null}
            {project.open_to_learners ? (
              <View style={{ alignSelf: "flex-start", backgroundColor: C.purple, borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: vs(3), marginTop: vs(10) }}>
                <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(11) }}>Open to learners</Text>
              </View>
            ) : null}
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
      <View
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: s(20), paddingBottom: vs(20), gap: vs(12),
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
            <DangerBtn onPress={() => setQuitSheetVisible(true)} label="Leave Project" />
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
