import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { fetchCompleted } from "./queries";
import { ArchiveCard } from "./ArchiveCard";
import { ConnectTeamSheet } from "./ConnectTeamSheet";
import type { ArchiveItem } from "./types";
import { ScreenLoader } from "@/components/ScreenLoader";

/** Appended after the last project so the deck ends deliberately. */
const END = "__end__";
type Page = ArchiveItem | typeof END;

export default function ArchiveDeck() {
  const { tokens: { C, GRADIENT } } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [sheetFor, setSheetFor] = useState<ArchiveItem | null>(null);
  // The pager needs a real pixel height per page, and paging only works once
  // it is known — so the list waits for the first layout pass.
  const [pageHeight, setPageHeight] = useState(0);
  const scrollRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await fetchCompleted();
    setItems(data);
    setError(e);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pages: Page[] = items.length > 0 ? [...items, END] : [];
  const total = items.length;
  const current = Math.min(index + 1, total);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageHeight <= 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.y / pageHeight));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: s(10),
        paddingHorizontal: s(14), paddingBottom: vs(10),
      }}>
        <Btn onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back to Discover" style={{ padding: s(4) }}>
          <ChevronLeft size={s(22)} color={C.white} />
        </Btn>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Archive position"
          accessibilityValue={{ now: current, min: 1, max: Math.max(total, 1) }}
          style={{ flex: 1, flexDirection: "row", gap: s(3) }}
        >
          {items.map((item, i) => (
            <View key={item.id} style={{
              flex: 1, height: 3, borderRadius: s(2),
              backgroundColor: i <= index ? C.purpleL : C.switchTrackOff,
            }} />
          ))}
        </View>

        <Text style={{ color: C.textFaint, fontFamily: FONT.bold, fontSize: fs(10) }}>
          {total > 0 ? `${current}/${total}` : ""}
        </Text>
      </View>

      <View style={{ flex: 1 }} onLayout={e => setPageHeight(e.nativeEvent.layout.height)}>
        {loading ? (
          <ScreenLoader />
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(24) }}>
            <Text style={{
              color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14),
              textAlign: "center", marginBottom: vs(14),
            }}>
              {error}
            </Text>
            <Btn onPress={load} accessibilityLabel="Retry loading the archive" style={{
              paddingHorizontal: s(20), minHeight: 44, justifyContent: "center",
              borderRadius: s(12), borderWidth: 1, borderColor: C.borderBright,
            }}>
              <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(14) }}>Retry</Text>
            </Btn>
          </View>
        ) : total === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(30) }}>
            <Text style={{
              color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), textAlign: "center",
            }}>
              Nothing has shipped yet. This is where finished projects will live.
            </Text>
          </View>
        ) : pageHeight > 0 ? (
          <FlashList
            ref={scrollRef}
            data={pages}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            keyExtractor={(page: Page) => (page === END ? END : page.id)}
            renderItem={({ item: page }) => (
              <View style={{ height: pageHeight, paddingHorizontal: s(14), paddingBottom: vs(14) }}>
                {page === END ? (
                  <View style={{
                    flex: 1, alignItems: "center", justifyContent: "center",
                    borderRadius: s(22), borderWidth: 1, borderColor: C.border,
                    backgroundColor: C.surface, paddingHorizontal: s(28),
                  }}>
                    <Text style={{
                      color: C.white, fontFamily: FONT.extraBold, fontSize: fs(19),
                      textAlign: "center", marginBottom: vs(6),
                    }}>
                      That&apos;s everything shipped.
                    </Text>
                    <Text style={{
                      color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12),
                      textAlign: "center", marginBottom: vs(18),
                    }}>
                      {total === 1
                        ? "One project delivered so far. Yours could be next."
                        : `${total} projects delivered so far. Yours could be next.`}
                    </Text>
                    <Btn
                      onPress={() => router.back()}
                      accessibilityLabel="Back to Discover"
                      style={{ borderRadius: s(13), overflow: "hidden" }}
                    >
                      <LinearGradient
                        colors={GRADIENT.ctaSoft}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: s(24) }}
                      >
                        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(13) }}>
                          Back to Discover
                        </Text>
                      </LinearGradient>
                    </Btn>
                  </View>
                ) : (
                  <>
                    <ArchiveCard item={page} />
                    <Btn
                      onPress={() => setSheetFor(page)}
                      accessibilityLabel={`Connect with the team behind ${page.title}`}
                      style={{ marginTop: vs(10), borderRadius: s(14), overflow: "hidden" }}
                    >
                      <LinearGradient
                        colors={GRADIENT.ctaSoft}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(12.5) }}>
                          Connect with the team
                        </Text>
                      </LinearGradient>
                    </Btn>
                  </>
                )}
              </View>
            )}
          />
        ) : null}
      </View>

      {sheetFor && (
        <ConnectTeamSheet
          visible
          projectId={sheetFor.id}
          projectTitle={sheetFor.title}
          onClose={() => setSheetFor(null)}
        />
      )}
    </SafeAreaView>
  );
}
