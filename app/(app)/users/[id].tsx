import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MapPin, BookOpen } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { Avatar } from "@/components/Avatar";
import { C, FONT } from "@/utils/theme";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
            <ChevronLeft size={s(18)} color="rgba(255,255,255,0.55)" />
            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
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
        {/* Back button */}
        <View style={{ paddingHorizontal: s(20), paddingTop: vs(16) }}>
          <Btn
            onPress={() => router.back()}
            pressScale={0.88}
            hitSlop={12}
            style={{ flexDirection: "row", alignItems: "center", gap: s(6), alignSelf: "flex-start" }}
          >
            <ChevronLeft size={s(18)} color="rgba(255,255,255,0.55)" />
            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily: FONT.medium,
                fontSize: fs(14),
              }}
            >
              Back
            </Text>
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
                    backgroundColor: "rgba(255,255,255,0.09)",
                    borderRadius: s(20),
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
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
    </SafeAreaView>
  );
}
