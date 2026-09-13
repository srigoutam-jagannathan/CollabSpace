import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { useAuth } from "@/features/auth/AuthContext";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useDiscoverData } from "./useDiscoverData";
import { sectionVisible } from "./ranking";
import { SectionFrame } from "./SectionFrame";
import { PulseStrip } from "./sections/PulseStrip";
import { NeedsYourSkills } from "./sections/NeedsYourSkills";
import { ActiveNow } from "./sections/ActiveNow";
import { PeopleToKnow } from "./sections/PeopleToKnow";
import { AddSkillsPrompt } from "./sections/AddSkillsPrompt";

export default function DiscoverScreen() {
  const { tokens: { C } } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [skills, setSkills] = useState<string[]>([]);
  const [department, setDepartment] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("skills, department")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSkills(data.skills ?? []);
        setDepartment(data.department ?? null);
      });
  }, [user?.id]);

  const { pulse, needs, needsMode, active, people, refreshing, refresh, retry } =
    useDiscoverData(skills, department);

  // Refetch on focus without clearing what is already on screen.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const allFailed =
    !!pulse.error && !!needs.error && !!active.error && !!people.error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(14),
      }}>
        <Text accessibilityRole="header" style={{
          color: C.white, fontFamily: FONT.extraBold, fontSize: fs(26),
        }}>
          Discover
        </Text>
        <Btn
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={12}
          accessibilityLabel="Notifications"
          style={{ padding: s(4) }}
        >
          <Bell size={s(22)} color={C.white} />
        </Btn>
      </View>

      {allFailed ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(24) }}>
          <Text style={{
            color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14),
            textAlign: "center", marginBottom: vs(16),
          }}>
            Couldn&apos;t reach CollabSpace. Check your connection and try again.
          </Text>
          <Btn
            onPress={refresh}
            accessibilityLabel="Retry loading Discover"
            style={{
              paddingHorizontal: s(20), paddingVertical: vs(10), borderRadius: s(12),
              borderWidth: 1, borderColor: C.borderBright,
            }}
          >
            <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(14) }}>Retry</Text>
          </Btn>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: vs(32) }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purpleL} />
          }
        >
          <SectionFrame
            title="Recent activity"
            visible={sectionVisible("pulse", pulse.data.length)}
            loading={pulse.loading && pulse.data.length === 0}
            error={pulse.error}
            onRetry={() => retry("pulse")}
          >
            <PulseStrip items={pulse.data} />
          </SectionFrame>

          {skills.length === 0 ? (
            <SectionFrame
              title="Needs your skills"
              visible
              loading={false}
              error={null}
              onRetry={() => {}}
            >
              <AddSkillsPrompt />
            </SectionFrame>
          ) : (
            <SectionFrame
              title={needsMode === "matched" ? "Needs your skills" : "New projects"}
              visible={sectionVisible("needs", needs.data.length)}
              loading={needs.loading && needs.data.length === 0}
              error={needs.error}
              onRetry={() => retry("needs")}
              onSeeAll={() => router.push({ pathname: "/(app)/discover/[section]", params: { section: "needs" } })}
            >
              <NeedsYourSkills items={needs.data} />
            </SectionFrame>
          )}

          <SectionFrame
            title="Active right now"
            visible={sectionVisible("active", active.data.length)}
            loading={active.loading && active.data.length === 0}
            error={active.error}
            onRetry={() => retry("active")}
            onSeeAll={() => router.push({ pathname: "/(app)/discover/[section]", params: { section: "active" } })}
          >
            <ActiveNow items={active.data} />
          </SectionFrame>

          <SectionFrame
            title="People to know"
            visible={sectionVisible("people", people.data.length)}
            loading={people.loading && people.data.length === 0}
            error={people.error}
            onRetry={() => retry("people")}
            onSeeAll={() => router.push({ pathname: "/(app)/discover/[section]", params: { section: "people" } })}
          >
            <PeopleToKnow items={people.data} />
          </SectionFrame>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
