import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MapPin, BookOpen, Share2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { ShareProfileSheet } from "@/components/ShareProfileSheet";
import { useAuth } from "@/features/auth/AuthContext";
import { InviteSheet } from "@/features/projects/InviteSheet";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
  department: string | null;
  bio: string | null;
  skills: string[];
  badges: string[];
  pvs_score: number | null;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function UserProfileScreen() {
  const { tokens: { C, GRADIENT } } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [canInvite, setCanInvite] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setProfile((data as unknown as PublicProfile) ?? null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user?.id || !id || user.id === id) return;

    supabase
      .from("connections")
      .select("status")
      .or(`and(requester_id.eq.${user.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${user.id})`)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status) setConnectionStatus(data.status);
      });

    supabase
      .from("projects")
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "recruiting")
      .limit(1)
      .then(({ data }) => setCanInvite((data ?? []).length > 0));
  }, [user?.id, id]);

  async function handleConnect() {
    if (!user?.id || !id) return;
    setConnecting(true);
    setActionError(null);

    // Row identity is the sorted pair; initiated_by records who asked.
    const ids = [user.id, id].sort();
    const { error } = await supabase.from("connections").insert({
      requester_id: ids[0],
      recipient_id: ids[1],
      initiated_by: user.id,
    });

    setConnecting(false);
    if (error) {
      setActionError("Couldn't send the request. Try again.");
      return;
    }
    setConnectionStatus("pending");
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" }}
        edges={["top"]}
      >
        <ActivityIndicator size="large" color={C.pink} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "transparent" }}
        edges={["top"]}
      >
        <View style={{ paddingHorizontal: s(20), paddingTop: vs(16) }}>
          <Btn
            onPress={() => router.back()}
            pressScale={0.88}
            hitSlop={12}
            style={{ flexDirection: "row", alignItems: "center", gap: s(6), alignSelf: "flex-start" }}
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color: C.textMuted,
              fontFamily: FONT.medium,
              fontSize: fs(16),
            }}
          >
            User not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const skills: string[] = profile.skills ?? [];
  const badges: string[] = profile.badges ?? [];
  const initials = getInitials(profile.full_name);

  const locationParts: string[] = [];
  if (profile.university) locationParts.push(profile.university);
  if (profile.department) locationParts.push(profile.department);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: vs(100) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button + share */}
        <View style={{ paddingHorizontal: s(20), paddingTop: vs(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Btn
            onPress={() => router.back()}
            pressScale={0.88}
            hitSlop={12}
            style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
          >
            <ChevronLeft size={s(18)} color={C.textMuted} />
            <Text style={{ color: C.textMuted, fontFamily: FONT.medium, fontSize: fs(14) }}>
              Back
            </Text>
          </Btn>
          <Btn onPress={() => setShareSheetOpen(true)} pressScale={0.88} hitSlop={12}>
            <View style={{ backgroundColor: C.surface, borderRadius: s(10), borderWidth: 1, borderColor: C.border, padding: s(8) }}>
              <Share2 size={s(18)} color={C.textMuted} strokeWidth={1.8} />
            </View>
          </Btn>
        </View>

        {/* Avatar */}
        <View style={{ alignItems: "center", marginTop: vs(20) }}>
          <View style={{ borderWidth: 2, borderColor: C.purpleL, borderRadius: s(40) }}>
            <Avatar url={profile.avatar_url} initials={initials} size={s(80)} bgColor={C.purple} />
          </View>
        </View>

        {/* Name */}
        <Text
          style={{
            color: C.white,
            fontFamily: FONT.extraBold,
            fontSize: fs(24),
            textAlign: "center",
            marginTop: vs(12),
            paddingHorizontal: s(20),
          }}
        >
          {profile.full_name ?? "Unknown"}
        </Text>

        {/* University + department */}
        {locationParts.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: s(6),
              marginTop: vs(6),
              paddingHorizontal: s(20),
            }}
          >
            <MapPin size={s(13)} color={C.textMuted} strokeWidth={1.8} />
            <Text
              style={{
                color: C.textMuted,
                fontFamily: FONT.regular,
                fontSize: fs(14),
                textAlign: "center",
              }}
            >
              {locationParts.join(" · ")}
            </Text>
          </View>
        )}

        {/* Bio */}
        {profile.bio ? (
          <Text
            style={{
              color: C.white,
              fontFamily: FONT.regular,
              fontSize: fs(14),
              lineHeight: vs(21),
              marginHorizontal: s(20),
              marginTop: vs(16),
              textAlign: "center",
            }}
          >
            {profile.bio}
          </Text>
        ) : null}

        {/* Skills */}
        {skills.length > 0 && (
          <View style={{ marginTop: vs(24), paddingHorizontal: s(20) }}>
            <Text
              style={{
                color: C.white,
                fontFamily: FONT.bold,
                fontSize: fs(16),
                marginBottom: vs(12),
              }}
            >
              Skills
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: s(8), paddingRight: s(4) }}
            >
              {skills.map((skill) => (
                <View
                  key={skill}
                  style={{
                    backgroundColor: "rgba(75,46,43,0.10)",
                    borderRadius: s(20),
                    borderWidth: 1,
                    borderColor: "rgba(192,133,82,0.20)",
                    paddingHorizontal: s(14),
                    paddingVertical: vs(7),
                  }}
                >
                  <Text
                    style={{
                      color: C.white,
                      fontFamily: FONT.semiBold,
                      fontSize: fs(13),
                    }}
                  >
                    {skill}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <View style={{ marginTop: vs(20), paddingHorizontal: s(20) }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: s(8),
                marginBottom: vs(12),
              }}
            >
              <BookOpen size={s(16)} color={C.white} strokeWidth={1.8} />
              <Text
                style={{
                  color: C.white,
                  fontFamily: FONT.bold,
                  fontSize: fs(16),
                }}
              >
                Badges
              </Text>
            </View>
            {badges.map((badge) => (
              <View
                key={badge}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(10),
                  paddingVertical: vs(6),
                }}
              >
                <View
                  style={{
                    width: s(6),
                    height: s(6),
                    borderRadius: s(3),
                    backgroundColor: C.yellow,
                  }}
                />
                <Text
                  style={{
                    color: C.textMuted,
                    fontFamily: FONT.regular,
                    fontSize: fs(14),
                    flex: 1,
                  }}
                >
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ShareProfileSheet
        visible={shareSheetOpen}
        profileId={profile.id}
        profileName={profile.full_name}
        avatarUrl={profile.avatar_url}
        university={profile.university}
        department={profile.department}
        skills={profile.skills ?? []}
        onClose={() => setShareSheetOpen(false)}
      />

      {user?.id !== id && (
        <View style={{ paddingHorizontal: s(20), paddingBottom: vs(20), gap: vs(8) }}>
          {actionError && (
            <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(12) }}>
              {actionError}
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: s(8) }}>
            {connectionStatus === "accepted" ? (
              <View style={{
                flex: 1, alignItems: "center", paddingVertical: vs(12), borderRadius: s(13),
                borderWidth: 1, borderColor: C.borderBright,
              }}>
                <Text style={{ color: C.success, fontFamily: FONT.bold, fontSize: fs(13) }}>Connected</Text>
              </View>
            ) : connectionStatus === "pending" ? (
              <View style={{
                flex: 1, alignItems: "center", paddingVertical: vs(12), borderRadius: s(13),
                borderWidth: 1, borderColor: C.border,
              }}>
                <Text style={{ color: C.textMuted, fontFamily: FONT.bold, fontSize: fs(13) }}>Request sent</Text>
              </View>
            ) : (
              <Btn
                onPress={handleConnect}
                disabled={connecting}
                accessibilityLabel={`Send a connection request to ${profile?.full_name ?? "this person"}`}
                style={{ flex: 1, alignItems: "center", paddingVertical: vs(12), borderRadius: s(13), overflow: "hidden" }}
              >
                <LinearGradient
                  colors={GRADIENT.ctaSoft}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
                />
                <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(13) }}>
                  {connecting ? "Sending…" : "Connect"}
                </Text>
              </Btn>
            )}

            {canInvite && (
              <Btn
                onPress={() => setInviteOpen(true)}
                accessibilityLabel={`Invite ${profile?.full_name ?? "this person"} to a project`}
                style={{
                  paddingHorizontal: s(18), paddingVertical: vs(12), borderRadius: s(13),
                  borderWidth: 1, borderColor: C.borderBright, alignItems: "center",
                }}
              >
                <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(13) }}>Invite</Text>
              </Btn>
            )}
          </View>
        </View>
      )}

      <InviteSheet
        visible={inviteOpen}
        talent={profile ? { id: profile.id, full_name: profile.full_name } : null}
        onClose={() => setInviteOpen(false)}
        onSent={() => setInviteOpen(false)}
      />
    </SafeAreaView>
  );
}
