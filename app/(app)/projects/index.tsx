import { useState, useCallback } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";
import { FolderKanban, Plus, Zap } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { Project } from "@/types/database";

function ProjectRow({ project, onPress }: { project: Project; onPress: () => void }) {
  const statusColor =
    project.status === "recruiting"
      ? "text-green-400"
      : project.status === "active"
        ? "text-primary-400"
        : "text-slate-500";

  return (
    <Pressable
      className="mx-4 mb-3 p-4 bg-surface-card rounded-2xl border border-surface-border active:opacity-70"
      onPress={onPress}
    >
      <View className="flex-row items-start justify-between mb-1">
        <Text className="text-white font-bold text-base flex-1 mr-2" numberOfLines={1}>
          {project.title}
        </Text>
        <Text className={`text-xs font-medium capitalize ${statusColor}`}>{project.status}</Text>
      </View>
      <Text className="text-slate-400 text-sm mb-3 leading-5" numberOfLines={2}>
        {project.description}
      </Text>
      {project.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((tag) => (
            <View key={tag} className="px-2 py-0.5 rounded-full bg-slate-800">
              <Text className="text-slate-400 text-xs">{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function MyProjectsScreen() {
  const { tokens: { C } } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [user]);

  // Refresh when tab comes into focus (e.g. after creating a project)
  useFocusEffect(
    useCallback(() => {
      fetchMyProjects();
    }, [fetchMyProjects])
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-4">
        <Text className="text-white text-xl font-bold">My Projects</Text>
        <Pressable
          className="w-9 h-9 rounded-full bg-primary-500 items-center justify-center active:opacity-70"
          onPress={() => router.push("/(app)/projects/create")}
        >
          <Plus size={18} color={C.white} />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : projects.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <FolderKanban size={48} color="#334155" />
          <Text className="text-slate-400 text-lg font-semibold mt-4">No projects yet</Text>
          <Text className="text-slate-600 text-sm text-center mt-2 mb-6">
            Launch your first project and get AI-powered insights instantly.
          </Text>
          <Pressable
            className="flex-row items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 active:opacity-70"
            onPress={() => router.push("/(app)/projects/create")}
          >
            <Zap size={16} color={C.white} />
            <Text className="text-white font-semibold">Launch a Project</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={({ item }) => (
            <ProjectRow
              project={item}
              onPress={() =>
                router.push({
                  pathname: "/(app)/projects/[id]/insights",
                  params: { id: item.id },
                })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
