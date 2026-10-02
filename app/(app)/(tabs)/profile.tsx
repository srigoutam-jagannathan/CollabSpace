import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Settings, BadgeCheck, Share2 } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { ShareProfileSheet } from "@/components/ShareProfileSheet";
import { supabase } from "@/lib/supabaseClient";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { ScreenLoader } from "@/components/ScreenLoader";
import { useOpenProjectPreview } from "@/utils/originLink";

type ProfileData = {
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  bio: string | null;
  pvs_score: number | null;
  skills: string[] | null;
  portfolio_links: { title: string; url: string }[] | null;
  badges: string[] | null;
};

type OwnedProject = {
  id: string;
  title: string;
  description: string;
  project_type: string | null;
  status: string;
  created_at: string;
};

type MyCollab = {
  membershipId: string;
  projectId: string;
  title: string;
  projectType: string | null;
  status: string;
  role: string;
  committed: boolean;
};

const DEV_PROFILE: ProfileData = {
  full_name: "Jacob (Dev)",
  avatar_url: null,
  department: "M.Des User Experience Design",
  bio: "Aspiring Ux/Ui Designer",
  pvs_score: 72,
  skills: ["Ui Design", "Figma", "Graphic Design", "Video Editing"],
  portfolio_links: [{ title: "Design Portfolio", url: "" }, { title: "Video Portfolio", url: "" }],
  badges: ["Reliable Collaborator", "Great Communicator"],
};

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: s(2) }}>
      {Array.from({ length: max }).map((_, i) => (
        <Text key={i} style={{ fontSize: fs(14), color: i < rating ? C.yellow : C.border }}>★</Text>
      ))}
    </View>
  );
}

function Section({ title, children, action }: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ paddingHorizontal: s(20), marginBottom: vs(28) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: vs(12) }}>
        <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(16) }}>{title}</Text>
        {action && (
          <Btn onPress={action.onPress} pressScale={0.9}>
            <Text style={{ color: C.pink, fontSize: fs(14), fontWeight: "600" }}>{action.label}</Text>
          </Btn>
        )}
      </View>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { tokens: { C, GRADIENT, GLASS } } = useTheme();
  const openPreview = useOpenProjectPreview();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<OwnedProject[]>([]);
  const [myCollabs, setMyCollabs] = useState<MyCollab[]>([]);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [showBadge, setShowBadge] = useState(true);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const loadProfile = useCallback(() => {
    if (!user) {
      setProfile(DEV_PROFILE);
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name, avatar_url, department, bio, pvs_score, skills, portfolio_links, badges")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setProfile({ full_name: user.user_metadata?.full_name ?? null, avatar_url: null, department: null, bio: null, pvs_score: 0, skills: [], portfolio_links: [], badges: [] });
        } else {
          setProfile(data as ProfileData);
        }
        setLoading(false);
      });
    supabase
      .from("projects")
      .select("id, title, description, project_type, status, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data: ownedProjects }) => {
        setMyProjects((ownedProjects as OwnedProject[]) ?? []);
      });
    supabase
      .from("project_members")
      .select("id, role, mou_accepted, project:projects!project_id(id, title, project_type, status, owner_id)")
      .eq("user_id", user.id)
      .then(({ data: memberData }) => {
        const collabs: MyCollab[] = (memberData ?? [])
          .filter((m: any) => m.project?.owner_id !== user.id)
          .map((m: any) => ({
            membershipId: m.id,
            projectId: m.project?.id ?? "",
            title: m.project?.title ?? "Unknown Project",
            projectType: m.project?.project_type ?? null,
            status: m.project?.status ?? "recruiting",
            role: m.role ?? "Member",
            committed: m.mou_accepted ?? false,
          }));
        setMyCollabs(collabs);
      });
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      AsyncStorage.getItem("privacy_prefs").then((raw) => {
        if (raw) {
          const prefs = JSON.parse(raw);
          if (typeof prefs.showUniversityBadge === "boolean") {
            setShowBadge(prefs.showUniversityBadge);
          }
        }
      });
    }, [loadProfile])
  );

  async function handleCommit(membershipId: string, projectTitle: string) {
    Alert.alert(
      "Commit to Project",
      `Confirm your commitment to "${projectTitle}"? This will be recorded as a collaboration event.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Commit",
          onPress: async () => {
            setSigningId(membershipId);
            try {
              const { error } = await supabase
                .from("project_members")
                .update({ mou_accepted: true, mou_accepted_at: new Date().toISOString() })
                .eq("id", membershipId);
              if (error) throw error;
              setMyCollabs((prev) =>
                prev.map((c) =>
                  c.membershipId === membershipId ? { ...c, committed: true } : c
                )
              );
            } catch {
              Alert.alert("Error", "Failed to commit. Please try again.");
            } finally {
              setSigningId(null);
            }
          },
        },
      ]
    );
  }

  const displayName = profile?.full_name ?? user?.user_metadata?.full_name ?? "Student";
  const initials = displayName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const score = profile?.pvs_score ?? 0;
  const skills = profile?.skills ?? [];
  const portfolioLinks = profile?.portfolio_links?.length ? profile.portfolio_links : [{ title: "Design Portfolio", url: "" }, { title: "Video Portfolio", url: "" }];
  const badges = profile?.badges?.length ? profile.badges : ["Reliable Collaborator", "Great Communicator"];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: vs(32) }} showsVerticalScrollIndicator={false}>

        {/* ── Screen header ─────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(20), paddingTop: vs(12), paddingBottom: vs(4) }}>
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(20) }}>Profile</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
            <Btn onPress={() => setShareSheetOpen(true)} pressScale={0.88} hitSlop={12}>
              <View style={{ backgroundColor: C.surface, borderRadius: s(10), borderWidth: 1, borderColor: C.border, padding: s(8) }}>
                <Share2 size={s(18)} color={C.textMuted} strokeWidth={1.8} />
              </View>
            </Btn>
            <Btn onPress={() => router.push("/(app)/settings" as any)} pressScale={0.88} hitSlop={12}>
              <View style={{ backgroundColor: C.surface, borderRadius: s(10), borderWidth: 1, borderColor: C.border, padding: s(8) }}>
                <Settings size={s(18)} color={C.textMuted} strokeWidth={1.8} />
              </View>
            </Btn>
          </View>
        </View>

        {/* ── Avatar + Identity ──────────────────────────────────────────── */}
        <View style={{ alignItems: "center", paddingTop: vs(20), paddingBottom: vs(28) }}>
          {/* Avatar with gradient ring */}
          <View style={{ marginBottom: vs(14) }}>
            <Avatar url={profile?.avatar_url} initials={initials} size={s(96)} ring />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: s(6), marginBottom: vs(4) }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(20) }}>{displayName}</Text>
            {showBadge && <BadgeCheck size={s(20)} color={C.pink} strokeWidth={2} />}
          </View>

          {profile?.department ? (
            <Text style={{ color: C.textMuted, fontSize: fs(13), marginBottom: vs(4) }}>{profile.department}</Text>
          ) : null}

          <Text style={{ color: C.textFaint, fontSize: fs(13), fontStyle: "italic" }}>
            "{profile?.bio ?? "Aspiring collaborator"}"
          </Text>
        </View>

        {/* ── Commitment Score ───────────────────────────────────────────── */}
        <Section title="Commitment Score">
          <View style={{ height: vs(8), backgroundColor: C.fieldBg, borderRadius: s(4), overflow: "hidden" }}>
            <LinearGradient
              colors={GRADIENT.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: vs(8), width: `${Math.min(score, 100)}%`, borderRadius: s(4) }}
            />
          </View>
          <Text style={{ color: C.textFaint, fontSize: fs(11), marginTop: vs(4) }}>{score} / 100</Text>
        </Section>

        {/* ── Skills ────────────────────────────────────────────────────── */}
        <Section title="Skills">
          {skills.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: s(8) }}>
                {skills.map((skill) => (
                  <View key={skill} style={{ backgroundColor: "rgba(75,46,43,0.10)", borderRadius: s(20), borderWidth: 1, borderColor: "rgba(192,133,82,0.20)", paddingHorizontal: s(14), paddingVertical: vs(7) }}>
                    <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13) }}>{skill}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={{ color: C.textFaint, fontSize: fs(13) }}>No skills added yet. Tap + Add to get started.</Text>
          )}
        </Section>

        {/* ── My Projects ────────────────────────────────────────────────── */}
        <Section title="My Projects">
          {myProjects.length === 0 ? (
            <Text style={{ color: C.textFaint, fontSize: fs(13) }}>No projects yet. Tap + New to create one.</Text>
          ) : (
            <View style={{ gap: vs(10) }}>
              {myProjects.map((proj) => (
                <Btn
                  key={proj.id}
                  onPress={() => openPreview(proj.id)}
                  pressScale={0.97}
                >
                  <View style={{
                    backgroundColor: C.surface, borderRadius: s(14), borderWidth: 1,
                    borderColor: C.border, padding: s(14),
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: vs(4) }}>
                      <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14), flex: 1, marginRight: s(8) }} numberOfLines={1}>
                        {proj.title}
                      </Text>
                      <View style={{ backgroundColor: proj.status === "recruiting" ? "rgba(52,211,153,0.15)" : C.fieldBg, borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: vs(2) }}>
                        <Text style={{ color: proj.status === "recruiting" ? C.success : C.textMuted, fontFamily: FONT.medium, fontSize: fs(10), textTransform: "capitalize" }}>
                          {proj.status}
                        </Text>
                      </View>
                    </View>
                    {proj.project_type ? (
                      <Text style={{ color: C.purpleL, fontFamily: FONT.medium, fontSize: fs(11), marginBottom: vs(4) }}>{proj.project_type}</Text>
                    ) : null}
                    <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), lineHeight: vs(18) }} numberOfLines={2}>
                      {proj.description}
                    </Text>
                  </View>
                </Btn>
              ))}
            </View>
          )}
        </Section>

        {/* ── My Collabs ─────────────────────────────────────────────────── */}
        {myCollabs.length > 0 && (
          <Section title="My Collabs">
            <View style={{ gap: vs(10) }}>
              {myCollabs.map((collab) => {
                const isSigning = signingId === collab.membershipId;
                return (
                  <Btn
                    key={collab.membershipId}
                    onPress={() => router.push({ pathname: "/(app)/(tabs)/chat/[id]", params: { id: collab.projectId } })}
                    pressScale={0.97}
                  >
                    <View style={{
                      backgroundColor: C.surface, borderRadius: s(14), borderWidth: 1,
                      borderColor: C.border, padding: s(14),
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: vs(4) }}>
                        <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14), flex: 1, marginRight: s(8) }} numberOfLines={1}>
                          {collab.title}
                        </Text>
                        <View style={{
                          backgroundColor: collab.status === "recruiting" ? "rgba(52,211,153,0.15)" : C.fieldBg,
                          borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: vs(2),
                        }}>
                          <Text style={{ color: collab.status === "recruiting" ? C.success : C.textMuted, fontFamily: FONT.medium, fontSize: fs(10), textTransform: "capitalize" }}>
                            {collab.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: C.purpleL, fontFamily: FONT.medium, fontSize: fs(12), marginBottom: vs(8) }}>
                        {collab.role}
                      </Text>
                      {collab.committed ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(5), alignSelf: "flex-start" }}>
                          <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: C.success }} />
                          <Text style={{ color: C.success, fontFamily: FONT.medium, fontSize: fs(11) }}>Committed</Text>
                        </View>
                      ) : (
                        <Btn
                          onPress={() => handleCommit(collab.membershipId, collab.title)}
                          pressScale={0.92}
                          disabled={isSigning}
                        >
                          <View style={{
                            alignSelf: "flex-end",
                            backgroundColor: GLASS.chip.backgroundColor,
                            borderWidth: 1,
                            borderColor: GLASS.chip.borderColor,
                            borderRadius: s(20),
                            paddingHorizontal: s(14),
                            paddingVertical: vs(6),
                            flexDirection: "row",
                            alignItems: "center",
                            gap: s(6),
                          }}>
                            {isSigning ? (
                              <ActivityIndicator size="small" color={C.purpleL} />
                            ) : (
                              <Text style={{ color: C.purpleL, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Commit</Text>
                            )}
                          </View>
                        </Btn>
                      )}
                    </View>
                  </Btn>
                );
              })}
            </View>
          </Section>
        )}

        {/* ── Portfolio ──────────────────────────────────────────────────── */}
        <Section title="Portfolio" action={{ label: "See all", onPress: () => {} }}>
          <View style={{ gap: vs(10) }}>
            {portfolioLinks.map((item, i) => (
              // Keyed on url plus index, not title: a title is free text, so
              // two links can legitimately share one, and a malformed row
              // (missing title) makes every key undefined at once.
              <View key={`${item.url ?? ""}-${i}`} style={{
                backgroundColor: "rgba(75,46,43,0.08)", borderRadius: s(14),
                borderWidth: 1, borderColor: "rgba(192,133,82,0.15)",
                flexDirection: "row", alignItems: "center",
                justifyContent: "space-between", padding: s(16),
              }}>
                <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14) }}>{item.title}</Text>
                <Btn pressScale={0.93} style={{ borderRadius: s(16), overflow: "hidden" }}>
                  <LinearGradient
                    colors={GRADIENT.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: s(16), paddingHorizontal: s(16), paddingVertical: vs(6) }}
                  >
                    <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(12) }}>Open</Text>
                  </LinearGradient>
                </Btn>
              </View>
            ))}
          </View>
        </Section>

        {/* ── Badges ────────────────────────────────────────────────────── */}
        <Section title="Badges">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
            {badges.map((badge) => (
              <View key={badge} style={{
                backgroundColor: C.surface, borderRadius: s(20),
                borderWidth: 1, borderColor: C.borderBright,
                paddingHorizontal: s(14), paddingVertical: vs(8),
              }}>
                <Text style={{ color: C.purpleL, fontSize: fs(13), fontWeight: "600" }}>{badge}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* ── Latest Feedback ────────────────────────────────────────────── */}
        <Section title="Latest Feedback">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: s(12) }}>
            <LinearGradient
              colors={[C.pink, C.purple]}
              style={{ width: s(36), height: s(36), borderRadius: s(18), alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: C.white, fontWeight: "700", fontSize: fs(13) }}>EM</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginBottom: vs(4) }}>
                <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14) }}>Emily</Text>
                <StarRating rating={4} />
              </View>
              <Text style={{ color: C.textMuted, fontSize: fs(13) }}>Great communication and creativity.</Text>
            </View>
          </View>
        </Section>

      </ScrollView>

      <ShareProfileSheet
        visible={shareSheetOpen}
        profileId={user?.id ?? ""}
        profileName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        university={null}
        department={profile?.department ?? null}
        skills={profile?.skills ?? []}
        onClose={() => setShareSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
