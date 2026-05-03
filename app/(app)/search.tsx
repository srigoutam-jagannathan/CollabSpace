import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Search, SlidersHorizontal, ChevronDown, Check, X, ArrowUpDown } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { C, FONT, GRADIENT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";
import type { Profile } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  owner: Pick<Profile, "id" | "full_name" | "avatar_url" | "university" | "pvs_score" | "department">;
};

// ── Filter config ─────────────────────────────────────────────────────────────

const FILTER_CATEGORIES = [
  {
    key: "category", label: "Category",
    options: ["Film", "Technology", "Business", "Design", "Music"],
    match: (p: DiscoveryProject, opts: string[]) =>
      opts.some(o => p.tags?.some(t => t.toLowerCase().includes(o.toLowerCase()))),
  },
  {
    key: "skills", label: "Skills Needed",
    options: ["Design", "Coding", "Marketing", "Video", "Writing"],
    match: (p: DiscoveryProject, opts: string[]) =>
      opts.some(o =>
        p.tags?.some(t => t.toLowerCase().includes(o.toLowerCase())) ||
        p.looking_for?.some(r => r.toLowerCase().includes(o.toLowerCase()))
      ),
  },
  {
    key: "type", label: "Project Type",
    options: ["Academic", "Side Project", "Startup", "Community"],
    match: (p: DiscoveryProject, opts: string[]) =>
      opts.some(o => (p.project_type ?? "").toLowerCase().includes(o.toLowerCase())),
  },
  {
    key: "collab", label: "Collaboration",
    options: ["Remote", "In-Person", "Hybrid"],
    match: (p: DiscoveryProject, opts: string[]) =>
      opts.some(o => (p.collaboration_style ?? "").toLowerCase() === o.toLowerCase()),
  },
  {
    key: "teamSize", label: "Team Size",
    options: ["1–2", "3–5", "6–10", "10+"],
    match: (p: DiscoveryProject, opts: string[]) => {
      const n = p.team_size ?? 0;
      return opts.some(o => {
        if (o === "1–2")  return n >= 1  && n <= 2;
        if (o === "3–5")  return n >= 3  && n <= 5;
        if (o === "6–10") return n >= 6  && n <= 10;
        if (o === "10+")  return n > 10;
        return false;
      });
    },
  },
  {
    key: "commitment", label: "Commitment",
    options: ["< 5 hrs/wk", "5–10 hrs/wk", "10–20 hrs/wk", "20+ hrs/wk"],
    match: (p: DiscoveryProject, opts: string[]) => {
      const h = p.commitment_hours ?? 0;
      return opts.some(o => {
        if (o === "< 5 hrs/wk")   return h > 0  && h < 5;
        if (o === "5–10 hrs/wk")  return h >= 5 && h <= 10;
        if (o === "10–20 hrs/wk") return h > 10 && h <= 20;
        if (o === "20+ hrs/wk")   return h > 20;
        return false;
      });
    },
  },
];

type SortOrder = "newest" | "oldest" | "az";
const SORT_OPTIONS: { key: SortOrder; label: string; sub: string }[] = [
  { key: "newest", label: "Newest First",   sub: "Most recently posted" },
  { key: "oldest", label: "Oldest First",   sub: "Posted longest ago"   },
  { key: "az",     label: "A → Z",          sub: "Alphabetical by title"  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({});
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select(`
        id, title, description, tags, looking_for,
        project_type, collaboration_style, team_size, commitment_hours, created_at,
        owner:profiles!owner_id(id, full_name, avatar_url, university, pvs_score, department)
      `)
      .order("created_at", { ascending: false });
    setProjects((data as unknown as DiscoveryProject[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  function toggleOption(catKey: string, option: string) {
    setSelectedOptions(prev => {
      const set = new Set(prev[catKey] ?? []);
      set.has(option) ? set.delete(option) : set.add(option);
      return { ...prev, [catKey]: set };
    });
  }

  const activeFilterCount = Object.values(selectedOptions).reduce((n, s) => n + s.size, 0);
  const currentSort = SORT_OPTIONS.find(o => o.key === sortOrder)!;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? projects.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some(t => t.toLowerCase().includes(q)) ||
          (p.owner?.department?.toLowerCase().includes(q) ?? false)
        )
      : [...projects];

    // Apply each active filter category using its own match function
    for (const cat of FILTER_CATEGORIES) {
      const opts = selectedOptions[cat.key];
      if (!opts || opts.size === 0) continue;
      list = list.filter(p => cat.match(p, [...opts]));
    }

    list.sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.title.localeCompare(b.title);
    });

    return list;
  }, [projects, query, selectedOptions, sortOrder]);

  const activeCat = FILTER_CATEGORIES.find(c => c.key === activeCategory)!;
  const activeSelected = selectedOptions[activeCategory] ?? new Set<string>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(14) }}>
        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(28) }}>Search</Text>
        <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(2) }}>
          Explore projects from across your university.
        </Text>
      </View>

      {/* ── Search bar ─────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        marginHorizontal: s(20), marginBottom: vs(10),
        backgroundColor: "rgba(255,255,255,0.07)",
        borderRadius: s(28), paddingHorizontal: s(16), height: vs(50),
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
      }}>
        <Search size={s(16)} color={C.textFaint} />
        <TextInput
          style={{ flex: 1, color: C.white, fontFamily: FONT.regular, fontSize: fs(14), marginLeft: s(10) }}
          placeholder="Search projects, tags, departments…"
          placeholderTextColor={C.textFaint}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Btn onPress={() => setQuery("")} hitSlop={10}>
            <X size={s(14)} color={C.textMuted} />
          </Btn>
        )}
        <Btn
          onPress={() => setShowFilter(v => !v)}
          style={{ marginLeft: s(10), flexDirection: "row", alignItems: "center", gap: s(5) }}
          hitSlop={10}
        >
          <SlidersHorizontal size={s(18)} color={activeFilterCount > 0 ? C.pink : C.textMuted} />
          {activeFilterCount > 0 && (
            <View style={{
              backgroundColor: C.pink, borderRadius: s(10),
              minWidth: s(18), height: s(18),
              alignItems: "center", justifyContent: "center", paddingHorizontal: s(4),
            }}>
              <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(10) }}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </Btn>
      </View>

      {/* ── Filter panel ───────────────────────────────────── */}
      {showFilter && (
        <View style={{
          marginHorizontal: s(20), marginBottom: vs(10),
          backgroundColor: "rgba(20,4,58,0.82)",
          borderRadius: s(18), overflow: "hidden",
          borderWidth: 1, borderColor: "rgba(192,54,160,0.20)",
        }}>
          <View style={{ flexDirection: "row" }}>
            {/* Category list */}
            <ScrollView
              style={{ width: s(130), borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.07)" }}
              showsVerticalScrollIndicator={false}
            >
              {FILTER_CATEGORIES.map(cat => {
                const count = selectedOptions[cat.key]?.size ?? 0;
                const active = activeCategory === cat.key;
                return (
                  <Btn key={cat.key} onPress={() => setActiveCategory(cat.key)} pressScale={0.97}>
                    <View style={{
                      paddingVertical: vs(12), paddingHorizontal: s(14),
                      backgroundColor: active ? "rgba(100,36,204,0.30)" : "transparent",
                      borderLeftWidth: active ? 2 : 0,
                      borderLeftColor: C.pink,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <Text style={{
                        color: active ? C.white : C.textMuted,
                        fontFamily: active ? FONT.semiBold : FONT.regular,
                        fontSize: fs(12),
                      }}>{cat.label}</Text>
                      {count > 0 && (
                        <View style={{
                          backgroundColor: C.pink, borderRadius: s(8),
                          width: s(16), height: s(16),
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(9) }}>{count}</Text>
                        </View>
                      )}
                    </View>
                  </Btn>
                );
              })}
            </ScrollView>

            {/* Options */}
            <View style={{ flex: 1, paddingVertical: vs(8), paddingHorizontal: s(12) }}>
              {activeCat.options.map(opt => {
                const checked = activeSelected.has(opt);
                return (
                  <Btn key={opt} onPress={() => toggleOption(activeCategory, opt)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: vs(10) }}
                    pressScale={0.97}
                  >
                    <View style={{
                      width: s(18), height: s(18), borderRadius: s(5), borderWidth: 1.5,
                      borderColor: checked ? C.pink : "rgba(255,255,255,0.25)",
                      backgroundColor: checked ? C.pink : "transparent",
                      marginRight: s(10), alignItems: "center", justifyContent: "center",
                    }}>
                      {checked && <Check size={s(11)} color={C.white} strokeWidth={3} />}
                    </View>
                    <Text style={{
                      color: checked ? C.white : C.textMuted,
                      fontFamily: checked ? FONT.semiBold : FONT.regular,
                      fontSize: fs(13),
                    }}>{opt}</Text>
                  </Btn>
                );
              })}
            </View>
          </View>

          {activeFilterCount > 0 && (
            <Btn
              onPress={() => setSelectedOptions({})}
              style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", padding: s(12), alignItems: "center" }}
              pressScale={0.97}
            >
              <Text style={{ color: C.pink, fontFamily: FONT.semiBold, fontSize: fs(13) }}>
                Clear all filters  ({activeFilterCount})
              </Text>
            </Btn>
          )}
        </View>
      )}

      {/* ── Results bar ────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: s(20), marginBottom: vs(10),
      }}>
        <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15) }}>
          {results.length} {results.length === 1 ? "Project" : "Projects"}
        </Text>

        {/* Sort pill */}
        <Btn
          onPress={() => setShowSortSheet(true)}
          style={{
            flexDirection: "row", alignItems: "center", gap: s(6),
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: s(20), paddingHorizontal: s(14), paddingVertical: vs(7),
            borderWidth: 1, borderColor: "rgba(192,54,160,0.25)",
          }}
          pressScale={0.95}
        >
          <ArrowUpDown size={s(13)} color={C.pink} />
          <Text style={{ color: C.white, fontFamily: FONT.medium, fontSize: fs(13) }}>
            {currentSort.label}
          </Text>
          <ChevronDown size={s(12)} color={C.textMuted} />
        </Btn>
      </View>

      {/* ── Results list ───────────────────────────────────── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: vs(24) }}
          showsVerticalScrollIndicator={false}
        >
          {results.map(project => (
            <View key={project.id} style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: s(16),
              borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
              marginBottom: vs(12), overflow: "hidden",
            }}>
              <LinearGradient
                colors={GRADIENT.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: vs(3) }}
              />
              <View style={{ padding: s(16) }}>
                <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(16), marginBottom: vs(4) }} numberOfLines={1}>
                  {project.title}
                </Text>
                {/* Meta row */}
                <View style={{ flexDirection: "row", gap: s(8), marginBottom: vs(8), flexWrap: "wrap" }}>
                  {project.project_type && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: s(10), paddingHorizontal: s(8), paddingVertical: vs(2) }}>
                      <Text style={{ color: "rgba(255,255,255,0.60)", fontFamily: FONT.medium, fontSize: fs(11) }}>{project.project_type}</Text>
                    </View>
                  )}
                  {project.collaboration_style && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: s(10), paddingHorizontal: s(8), paddingVertical: vs(2) }}>
                      <Text style={{ color: "rgba(255,255,255,0.60)", fontFamily: FONT.medium, fontSize: fs(11) }}>{project.collaboration_style}</Text>
                    </View>
                  )}
                  {(project.team_size ?? 0) > 0 && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: s(10), paddingHorizontal: s(8), paddingVertical: vs(2) }}>
                      <Text style={{ color: "rgba(255,255,255,0.60)", fontFamily: FONT.medium, fontSize: fs(11) }}>
                        Team of {project.team_size}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: FONT.regular, fontSize: fs(13), lineHeight: vs(19), marginBottom: vs(12) }} numberOfLines={2}>
                  {project.description}
                </Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Btn
                    onPress={() => router.push({ pathname: "/(app)/projects/[id]/preview", params: { id: project.id } })}
                    style={{ backgroundColor: C.purple, paddingHorizontal: s(18), paddingVertical: vs(8), borderRadius: s(20) }}
                    pressScale={0.94}
                  >
                    <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Preview Project</Text>
                  </Btn>
                </View>
              </View>
            </View>
          ))}

          {results.length === 0 && (
            <View style={{ alignItems: "center", marginTop: vs(60) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(16), marginBottom: vs(8) }}>
                No projects found
              </Text>
              <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13), textAlign: "center" }}>
                {activeFilterCount > 0 ? "Try removing some filters." : "Be the first to post one!"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sort bottom sheet ───────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showSortSheet} onRequestClose={() => setShowSortSheet(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
          onPress={() => setShowSortSheet(false)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{
              backgroundColor: "#180440",
              borderTopLeftRadius: s(28), borderTopRightRadius: s(28),
              paddingTop: vs(8), paddingBottom: vs(36),
              borderTopWidth: 1, borderColor: "rgba(192,54,160,0.25)",
            }}>
              {/* Handle */}
              <View style={{
                width: s(36), height: vs(4), borderRadius: s(2),
                backgroundColor: "rgba(255,255,255,0.2)",
                alignSelf: "center", marginBottom: vs(20),
              }} />

              <Text style={{
                color: C.white, fontFamily: FONT.bold, fontSize: fs(17),
                paddingHorizontal: s(24), marginBottom: vs(16),
              }}>
                Sort by
              </Text>

              {SORT_OPTIONS.map((opt, i) => {
                const selected = sortOrder === opt.key;
                return (
                  <Btn
                    key={opt.key}
                    onPress={() => { setSortOrder(opt.key); setShowSortSheet(false); }}
                    pressScale={0.97}
                  >
                    <View style={{
                      flexDirection: "row", alignItems: "center",
                      paddingHorizontal: s(24), paddingVertical: vs(16),
                      backgroundColor: selected ? "rgba(192,54,160,0.12)" : "transparent",
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: "rgba(255,255,255,0.06)",
                    }}>
                      {/* Left: radio dot */}
                      <View style={{
                        width: s(22), height: s(22), borderRadius: s(11),
                        borderWidth: 2,
                        borderColor: selected ? C.pink : "rgba(255,255,255,0.25)",
                        alignItems: "center", justifyContent: "center",
                        marginRight: s(14),
                      }}>
                        {selected && (
                          <View style={{
                            width: s(10), height: s(10), borderRadius: s(5),
                            backgroundColor: C.pink,
                          }} />
                        )}
                      </View>

                      {/* Labels */}
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          color: selected ? C.white : C.textMuted,
                          fontFamily: selected ? FONT.bold : FONT.medium,
                          fontSize: fs(15),
                        }}>{opt.label}</Text>
                        <Text style={{
                          color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(2),
                        }}>{opt.sub}</Text>
                      </View>

                      {selected && <Check size={s(18)} color={C.pink} strokeWidth={2.5} />}
                    </View>
                  </Btn>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
