import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { useAuth } from "@/features/auth/AuthContext";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { fetchActive, fetchNeeds, fetchPeople, fetchMemberProjectIds } from "./queries";
import { rankActive, rankNeeds, rankPeople } from "./ranking";
import { NeedsYourSkills } from "./sections/NeedsYourSkills";
import { ActiveNow } from "./sections/ActiveNow";
import { PeopleToKnow } from "./sections/PeopleToKnow";

const TITLES: Record<string, string> = {
  needs: "Needs your skills",
  active: "Active right now",
  people: "People to know",
};

export function SectionListScreen({ section }: { section: string }) {
  const { tokens: { C } } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Separate from `loading`: drives the pull-to-refresh spinner once content
  // is already on screen, so a manual pull actually shows feedback instead
  // of appearing to do nothing while the refetch is in flight.
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);

    if (section === "needs") {
      const [skillsRow, memberIds] = await Promise.all([
        supabase.from("profiles").select("skills").eq("id", user.id).single(),
        fetchMemberProjectIds(user.id),
      ]);
      const { data, error: e } = await fetchNeeds(user.id, skillsRow.data?.skills ?? [], memberIds);
      // Infinity lifts the 3-card section cap — this screen shows every match.
      if (e) setError(e); else setRows(rankNeeds(data, Infinity));
    } else if (section === "active") {
      const { data, error: e } = await fetchActive();
      if (e) setError(e); else setRows(rankActive(data, Infinity));
    } else if (section === "people") {
      const [profileRow, result] = await Promise.all([
        supabase.from("profiles").select("department").eq("id", user.id).single(),
        fetchPeople(user.id),
      ]);
      if (result.error) setError(result.error);
      else setRows(rankPeople(result.data, profileRow.data?.department ?? null, Infinity));
    }
    setLoading(false);
    setRefreshing(false);
  }, [section, user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: s(10),
        paddingHorizontal: s(16), paddingVertical: vs(10),
      }}>
        <Btn onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={{ padding: s(4) }}>
          <ChevronLeft size={s(22)} color={C.white} />
        </Btn>
        <Text accessibilityRole="header" style={{
          color: C.white, fontFamily: FONT.extraBold, fontSize: fs(19),
        }}>
          {TITLES[section] ?? "Discover"}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.purpleL} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(24) }}>
          <Text style={{
            color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14),
            textAlign: "center", marginBottom: vs(14),
          }}>
            {error}
          </Text>
          <Btn
            onPress={load}
            accessibilityLabel="Retry"
            style={{
              paddingHorizontal: s(20), paddingVertical: vs(10), borderRadius: s(12),
              borderWidth: 1, borderColor: C.borderBright,
            }}
          >
            <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(14) }}>Retry</Text>
          </Btn>
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingBottom: vs(32) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purpleL} />}
          renderItem={({ item }) => {
            if (section === "needs") return <NeedsYourSkills items={[item]} />;
            // ActiveNow and PeopleToKnow are horizontal rails by default (a
            // fixed-width card in its own horizontal ScrollView). Rendered
            // one-per-row in this vertical list that would show a
            // left-aligned card with a dead scroll gesture, so this screen
            // asks for their full-width "row" variant instead.
            if (section === "active") return <ActiveNow items={[item]} variant="row" />;
            return <PeopleToKnow items={[item]} variant="row" />;
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: vs(60) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14) }}>
                Nothing here yet.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
