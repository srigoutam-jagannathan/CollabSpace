import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { ProgressLine } from "@/components/ProgressLine";
import { fetchPendingCount } from "@/features/notifications/pending";
import { useAuth } from "@/features/auth/AuthContext";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useDiscoverData } from "./useDiscoverData";
import { sectionVisible } from "./ranking";
import { SectionFrame } from "./SectionFrame";
import { NeedsYourSkills } from "./sections/NeedsYourSkills";
import { ActiveNow } from "./sections/ActiveNow";
import { PeopleToKnow } from "./sections/PeopleToKnow";
import { ShippedRail } from "./sections/ShippedRail";
import { AddSkillsPrompt } from "./sections/AddSkillsPrompt";
import { NoMatchesPrompt } from "./sections/NoMatchesPrompt";

export default function DiscoverScreen() {
  const { tokens: { C, GRADIENT } } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [skills, setSkills] = useState<string[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

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

  const {
    needs, active, people, shipped,
    refreshing, revalidating, stale, refresh, revalidate, retry,
  } = useDiscoverData(skills, department);

  // Refetch on focus without clearing what is already on screen. revalidate()
  // rather than refresh() so this does not drive the pull-to-refresh spinner.
  // The bell recounts here too, so acting on a notification and coming back
  // clears the dot.
  useFocusEffect(useCallback(() => {
    revalidate();
    if (user?.id) fetchPendingCount(user.id).then(setPending);
  }, [revalidate, user?.id]));

  const allFailed =
    !!needs.error && !!active.error && !!people.error && !!shipped.error;

  const hasContent =
    needs.data.length > 0 ||
    active.data.length > 0 || people.data.length > 0 ||
    shipped.data.length > 0;

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
          accessibilityLabel={
            pending > 0
              ? `Notifications, ${pending} waiting for you`
              : "Notifications"
          }
          style={{ padding: s(4) }}
        >
          <Bell size={s(22)} color={C.white} />
          {pending > 0 && (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                position: "absolute", top: 0, right: 0,
                width: s(8), height: s(8), borderRadius: s(4),
                backgroundColor: C.purpleL,
                // Ringed in the page background so the dot reads as a separate
                // mark rather than a smudge on the bell.
                borderWidth: 1.5, borderColor: GRADIENT.bg[0],
              }}
            />
          )}
        </Btn>
      </View>

      {/* Only once something is on screen — during the first load the
          skeletons already say the screen is working. */}
      <ProgressLine visible={revalidating && hasContent} />

      {stale && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: s(10),
          marginHorizontal: s(20), marginBottom: vs(10),
          paddingHorizontal: s(12), paddingVertical: vs(8),
          borderRadius: s(10), borderWidth: 1, borderColor: C.border,
          backgroundColor: C.surface,
        }}>
          <Text
            accessibilityRole="alert"
            style={{ flex: 1, color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(11.5) }}
          >
            Showing saved results — couldn&apos;t reach CollabSpace.
          </Text>
          <Btn
            onPress={refresh}
            accessibilityLabel="Retry loading Discover"
            style={{
              paddingHorizontal: s(10), paddingVertical: vs(5), borderRadius: s(8),
              borderWidth: 1, borderColor: C.borderBright,
            }}
          >
            <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(11) }}>Retry</Text>
          </Btn>
        </View>
      )}

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
          {skills.length === 0 ? (
            <SectionFrame
              title="Projects for you"
              subtitle="Roles you can fill"
              skeleton="hero"
              visible
              loading={false}
              error={null}
              onRetry={() => {}}
            >
              <AddSkillsPrompt />
            </SectionFrame>
          ) : (
            <SectionFrame
              title="Projects for you"
              subtitle="Roles you can fill"
              skeleton="hero"
              visible
              loading={needs.loading && needs.data.length === 0}
              error={needs.error}
              onRetry={() => retry("needs")}
              onSeeAll={needs.data.length > 0
                ? () => router.push({ pathname: "/(app)/discover/[section]", params: { section: "needs" } })
                : undefined}
            >
              {needs.data.length > 0 ? <NeedsYourSkills items={needs.data} /> : <NoMatchesPrompt />}
            </SectionFrame>
          )}

          {/* Second, and gated: sectionVisible hides it below five completed
              projects. Its chevron opens the Archive rather than a see-all,
              because the Archive is its see-all. */}
          <SectionFrame
            title="Shipped from Belfast"
            subtitle="Finished projects from QUB and Ulster"
            skeleton="rail"
            visible={sectionVisible("shipped", shipped.data.length)}
            loading={shipped.loading && shipped.data.length === 0}
            error={shipped.error}
            onRetry={() => retry("shipped")}
            onSeeAll={() => router.push("/(app)/archive")}
          >
            <ShippedRail items={shipped.data} />
          </SectionFrame>

          <SectionFrame
            title="Active this week"
            subtitle="Teams making progress"
            skeleton="rail"
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
            skeleton="people"
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
