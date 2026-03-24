import { useState, useCallback, useRef } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { useAuth } from "@/features/auth/AuthContext";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscoveryProject = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  looking_for: string[];
  project_type: string | null;
  collaboration_style: string | null;
  team_size: number | null;
  commitment_hours: number | null;
  created_at: string;
  owner_id: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    university: string | null;
    pvs_score: number | null;
    department: string | null;
  };
};

type TalentProfile = {
  id: string;
  full_name: string | null;
  department: string | null;
  university: string | null;
  bio: string | null;
  skills: string[];
  pvs_score: number | null;
};

// ─── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  currentUserId,
}: {
  project: DiscoveryProject;
  currentUserId: string | undefined;
}) {
  const router = useRouter();
  const navigating = useRef(false);
  const tags: string[] = project.tags ?? [];

  const metaPills: string[] = [];
  if (project.project_type) metaPills.push(project.project_type);
  if (project.collaboration_style) metaPills.push(project.collaboration_style);
  if (project.team_size && project.team_size > 0)
    metaPills.push(`Team of ${project.team_size}`);
  if (project.commitment_hours && project.commitment_hours > 0)
    metaPills.push(`${project.commitment_hours}h/wk`);

  function handleCardPress() {
    if (navigating.current) return;
    navigating.current = true;
    router.push({ pathname: "/(app)/projects/[id]/preview", params: { id: project.id } });
    setTimeout(() => { navigating.current = false; }, 800);
  }

  return (
    <Btn
      onPress={handleCardPress}
      style={{ marginHorizontal: s(14) }}
      pressScale={0.97}
    >
      <View style={{
        borderRadius: s(20),
        backgroundColor: C.yellow,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 5,
      }}>
        <View style={{ height: vs(4), backgroundColor: C.pinkD }} />
        <View style={{ padding: s(18), paddingBottom: s(16) }}>
          <Text style={{ color: "#1a0a2e", fontFamily: FONT.extraBold, fontSize: fs(17), letterSpacing: -0.3, marginBottom: vs(8) }} numberOfLines={1}>
            {project.title}
          </Text>

          {metaPills.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(5), marginBottom: vs(10) }}>
              {metaPills.map((pill) => (
                <View key={pill} style={{ backgroundColor: "rgba(26,10,46,0.10)", borderRadius: s(8), paddingHorizontal: s(9), paddingVertical: vs(3) }}>
                  <Text style={{ color: "rgba(26,10,46,0.65)", fontFamily: FONT.semiBold, fontSize: fs(10.5) }}>{pill}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={{ color: "rgba(26,10,46,0.60)", fontFamily: FONT.regular, fontSize: fs(13), lineHeight: vs(20), marginBottom: vs(10) }} numberOfLines={2}>
            {project.description}
          </Text>

          {tags.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(5), marginBottom: vs(12) }}>
              {tags.slice(0, 3).map((tag) => (
                <View key={tag} style={{ backgroundColor: "rgba(26,10,46,0.08)", borderRadius: s(8), paddingHorizontal: s(9), paddingVertical: vs(3), borderWidth: 1, borderColor: "rgba(26,10,46,0.12)" }}>
                  <Text style={{ color: "rgba(26,10,46,0.65)", fontFamily: FONT.medium, fontSize: fs(11) }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: "rgba(26,10,46,0.08)", marginBottom: vs(10) }} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "rgba(26,10,46,0.45)", fontFamily: FONT.medium, fontSize: fs(12) }}>
              by {project.owner?.full_name ?? "Unknown"}
            </Text>
            {project.owner_id !== currentUserId && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({ pathname: "/(app)/projects/[id]/join", params: { id: project.id } });
                }}
                style={{ backgroundColor: C.purple, borderRadius: s(14), paddingHorizontal: s(13), paddingVertical: vs(6) }}
              >
                <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Request to Join</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Btn>
  );
}

// ─── Talent Card ───────────────────────────────────────────────────────────────

function TalentCard({
  talent,
  connectionStatus,
  onConnect,
}: {
  talent: TalentProfile;
  connectionStatus?: "pending" | "accepted" | "rejected";
  onConnect?: () => void;
}) {
  const router = useRouter();
  const initials = talent.full_name
    ? talent.full_name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const skills = talent.skills?.slice(0, 4) ?? [];

  return (
    <Btn
      onPress={() => router.push({ pathname: "/(app)/users/[id]", params: { id: talent.id } })}
      style={{ marginHorizontal: s(16), marginBottom: vs(16) }}
      pressScale={0.97}
    >
      <View style={{
        borderRadius: s(18),
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        padding: s(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(12), marginBottom: vs(12) }}>
          {/* Avatar */}
          <View style={{ width: s(48), height: s(48), borderRadius: s(24), backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16) }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15) }} numberOfLines={1}>
              {talent.full_name ?? "Unknown"}
            </Text>
            {talent.department ? (
              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(2) }} numberOfLines={1}>
                {talent.department}
              </Text>
            ) : null}
            {talent.university ? (
              <Text style={{ color: C.purpleL, fontFamily: FONT.medium, fontSize: fs(11), marginTop: vs(1) }}>
                {talent.university === "qub" ? "Queen's University Belfast" : talent.university === "ulster" ? "Ulster University" : talent.university}
              </Text>
            ) : null}
          </View>
        </View>

        {talent.bio ? (
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), lineHeight: vs(18), marginBottom: vs(10) }} numberOfLines={2}>
            "{talent.bio}"
          </Text>
        ) : null}

        {skills.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(6) }}>
            {skills.map((skill) => (
              <View key={skill} style={{ backgroundColor: C.yellow, borderRadius: s(14), paddingHorizontal: s(12), paddingVertical: vs(4) }}>
                <Text style={{ color: "#1a0a2e", fontFamily: FONT.semiBold, fontSize: fs(11) }}>{skill}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Connect button */}
        <View style={{ marginTop: vs(12) }}>
          {connectionStatus === "accepted" ? (
            <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(52,211,153,0.15)", borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: "rgba(52,211,153,0.3)" }}>
              <Text style={{ color: C.success, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Connected</Text>
            </View>
          ) : connectionStatus === "pending" ? (
            <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Pending</Text>
            </View>
          ) : connectionStatus === "rejected" ? (
            <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(248,113,113,0.1)", borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: "rgba(248,113,113,0.2)" }}>
              <Text style={{ color: C.danger, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Not Available</Text>
            </View>
          ) : (
            <Btn onPress={onConnect} pressScale={0.93} style={{ alignSelf: "flex-start" }}>
              <View style={{ backgroundColor: C.purple, borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6) }}>
                <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Connect</Text>
              </View>
            </Btn>
          )}
        </View>
      </View>
    </Btn>
  );
}

// ─── Tab Pill ──────────────────────────────────────────────────────────────────

function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Btn onPress={onPress} pressScale={0.93} style={{ flex: 1 }}>
      <View style={{
        paddingVertical: vs(9),
        borderRadius: s(14),
        alignItems: "center",
        backgroundColor: active ? C.purple : "transparent",
      }}>
        <Text style={{
          color: active ? C.white : C.textMuted,
          fontFamily: active ? FONT.bold : FONT.medium,
          fontSize: fs(14),
        }}>
          {label}
        </Text>
      </View>
    </Btn>
  );
}

// ─── Discovery Feed ────────────────────────────────────────────────────────────

export default function DiscoveryFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"projects" | "talents">("projects");
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTalents, setLoadingTalents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Map<string, "pending" | "accepted" | "rejected">>(new Map());
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("projects")
      .select(`id, title, description, tags, looking_for, project_type, collaboration_style, team_size, commitment_hours, created_at, owner_id, owner:profiles!owner_id(id, full_name, avatar_url, university, pvs_score, department)`)
      .order("created_at", { ascending: false });
    if (fetchError) setError("Failed to load projects.");
    else setProjects((data as unknown as DiscoveryProject[]) ?? []);
    setLoadingProjects(false);
  }, []);

  const fetchTalents = useCallback(async () => {
    if (!user) return;
    setLoadingTalents(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, department, university, bio, skills, pvs_score")
      .neq("id", user.id)
      .order("pvs_score", { ascending: false });
    setTalents((data as TalentProfile[]) ?? []);
    setLoadingTalents(false);
  }, [user]);

  const fetchConnectionStatuses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("connections")
      .select("requester_id, recipient_id, status")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

    const map = new Map<string, "pending" | "accepted" | "rejected">();
    (data ?? []).forEach((c: any) => {
      const otherId = c.requester_id === user.id ? c.recipient_id : c.requester_id;
      map.set(otherId, c.status);
    });
    setConnectionStatuses(map);
  }, [user]);

  const checkUnreadNotif = useCallback(async () => {
    if (!user) return;
    // Pending incoming connection requests
    const { count: connCount } = await supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .neq("initiated_by", user.id)
      .eq("status", "pending");

    // Unapproved join requests on owned projects
    const { data: ownedProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", user.id);
    let joinCount = 0;
    if (ownedProjects && ownedProjects.length > 0) {
      const ownedIds = ownedProjects.map((p: any) => p.id);
      const { count } = await supabase
        .from("project_members")
        .select("user_id", { count: "exact", head: true })
        .in("project_id", ownedIds)
        .eq("mou_accepted", false);
      joinCount = count ?? 0;
    }
    setHasUnreadNotif((connCount ?? 0) > 0 || joinCount > 0);
  }, [user]);

  useFocusEffect(useCallback(() => {
    fetchProjects();
    checkUnreadNotif();
    if (activeTab === "talents") fetchConnectionStatuses();
  }, [fetchProjects, fetchConnectionStatuses, checkUnreadNotif, activeTab]));

  function handleTabChange(tab: "projects" | "talents") {
    setActiveTab(tab);
    if (tab === "talents" && talents.length === 0) {
      fetchTalents();
      fetchConnectionStatuses();
    }
  }

  const isLoading = activeTab === "projects" ? loadingProjects : loadingTalents;
  const listData = activeTab === "projects" ? projects : talents;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(16) }}>
        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(26) }}>Discover</Text>
        <Btn onPress={() => router.push("/(app)/notifications")} hitSlop={12} pressScale={0.88}>
          <View style={{ position: "relative" }}>
            <Bell size={s(22)} color="rgba(255,255,255,0.7)" />
            {hasUnreadNotif && (
              <View style={{ position: "absolute", top: -2, right: -2, width: s(9), height: s(9), borderRadius: s(5), backgroundColor: C.pink, borderWidth: 1.5, borderColor: "rgba(18,0,45,1)" }} />
            )}
          </View>
        </Btn>
      </View>

      {/* Tab switcher */}
      <View style={{
        flexDirection: "row",
        marginHorizontal: s(20),
        marginBottom: vs(12),
        backgroundColor: C.surface,
        borderRadius: s(16),
        borderWidth: 1,
        borderColor: C.border,
        padding: s(4),
        gap: s(4),
      }}>
        <TabPill label="Projects" active={activeTab === "projects"} onPress={() => handleTabChange("projects")} />
        <TabPill label="Talents" active={activeTab === "talents"} onPress={() => handleTabChange("talents")} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(24) }}>
          <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(14), textAlign: "center", marginBottom: vs(16) }}>{error}</Text>
          <Btn onPress={fetchProjects} style={{ backgroundColor: C.purple, paddingHorizontal: s(20), paddingVertical: vs(10), borderRadius: s(12) }}>
            <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(14) }}>Retry</Text>
          </Btn>
        </View>
      ) : activeTab === "projects" ? (
        <FlashList
          data={projects}
          renderItem={({ item }) => <ProjectCard project={item as DiscoveryProject} currentUserId={user?.id} />}
          keyExtractor={(item) => (item as DiscoveryProject).id}
          contentContainerStyle={{ paddingTop: vs(12), paddingBottom: vs(32) }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: vs(12) }} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: vs(60) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.medium, fontSize: fs(15) }}>No projects yet.</Text>
              <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(6) }}>Tap + to post the first one!</Text>
            </View>
          }
        />
      ) : (
        <FlashList
          data={talents}
          renderItem={({ item }) => (
            <TalentCard
              talent={item as TalentProfile}
              connectionStatus={connectionStatuses.get((item as TalentProfile).id)}
              onConnect={async () => {
                if (!user) return;
                const ids = [user.id, (item as TalentProfile).id].sort();
                const { error } = await supabase.from("connections").insert({
                  requester_id: ids[0],
                  recipient_id: ids[1],
                  initiated_by: user.id,
                });
                if (!error) {
                  setConnectionStatuses((prev) => new Map(prev).set((item as TalentProfile).id, "pending"));
                }
              }}
            />
          )}
          keyExtractor={(item) => (item as TalentProfile).id}
          contentContainerStyle={{ paddingTop: vs(4), paddingBottom: vs(24) }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: vs(60) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.medium, fontSize: fs(15) }}>No other students yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
