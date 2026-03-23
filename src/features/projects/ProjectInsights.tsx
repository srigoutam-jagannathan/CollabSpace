import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, Copy, Check, Scale, Cpu, Megaphone, Zap, MessageSquare } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import type { Project } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubAgentPrompt {
  domain: "legal" | "tech" | "marketing";
  label: string;
  system_prompt: string;
  starter_question: string;
}

type DomainConfig = {
  icon: typeof Scale;
  color: string;
  bgClass: string;
  borderClass: string;
};

const DOMAIN_CONFIG: Record<SubAgentPrompt["domain"], DomainConfig> = {
  legal: {
    icon: Scale,
    color: "#f59e0b",
    bgClass: "bg-amber-950/40",
    borderClass: "border-amber-800/40",
  },
  tech: {
    icon: Cpu,
    color: "#3b82f6",
    bgClass: "bg-primary-950/40",
    borderClass: "border-primary-800/40",
  },
  marketing: {
    icon: Megaphone,
    color: "#10b981",
    bgClass: "bg-emerald-950/40",
    borderClass: "border-emerald-800/40",
  },
};

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({ prompt }: { prompt: SubAgentPrompt }) {
  const [copied, setCopied] = useState(false);
  const config = DOMAIN_CONFIG[prompt.domain];
  const Icon = config.icon;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(prompt.system_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View className={`mb-4 rounded-2xl border p-4 ${config.bgClass} ${config.borderClass}`}>
      {/* Card header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Icon size={18} color={config.color} />
          <Text className="text-white font-bold text-base">{prompt.label}</Text>
        </View>
        <Pressable
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 active:opacity-60"
          onPress={handleCopy}
        >
          {copied ? (
            <Check size={14} color="#10b981" />
          ) : (
            <Copy size={14} color="#94a3b8" />
          )}
          <Text className={`text-xs font-medium ${copied ? "text-emerald-400" : "text-slate-400"}`}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
      </View>

      {/* Prompt preview */}
      <Text className="text-slate-300 text-sm leading-5 mb-3" numberOfLines={5}>
        {prompt.system_prompt}
      </Text>

      {/* Starter question */}
      <View className="bg-slate-900/60 rounded-xl p-3">
        <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
          Starter Question
        </Text>
        <Text className="text-slate-300 text-sm italic leading-5">
          {prompt.starter_question}
        </Text>
      </View>
    </View>
  );
}

// ─── Project Insights ─────────────────────────────────────────────────────────

export default function ProjectInsights({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [prompts, setPrompts] = useState<SubAgentPrompt[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch project details
  useEffect(() => {
    if (!projectId) return;

    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setProject(data as Project);
        setLoadingProject(false);
      });
  }, [projectId]);

  // Call analyze-project Edge Function once project is loaded
  useEffect(() => {
    if (!project) return;

    setLoadingAI(true);
    setAiError(null);

    supabase.functions
      .invoke("analyze-project", {
        body: {
          project_description: project.description,
          looking_for: project.looking_for,
          tags: project.tags,
        },
      })
      .then(({ data, error }) => {
        if (error || !data?.sub_agent_prompts) {
          setAiError("Could not generate prompts. The function may not be deployed yet.");
        } else {
          setPrompts(data.sub_agent_prompts as SubAgentPrompt[]);
        }
        setLoadingAI(false);
      });
  }, [project]);

  const retryAI = () => {
    if (!project) return;
    setAiError(null);
    setLoadingAI(true);
    supabase.functions
      .invoke("analyze-project", {
        body: {
          project_description: project.description,
          looking_for: project.looking_for,
          tags: project.tags,
        },
      })
      .then(({ data, error }) => {
        if (error || !data?.sub_agent_prompts) {
          setAiError("Could not generate prompts. The function may not be deployed yet.");
        } else {
          setPrompts(data.sub_agent_prompts as SubAgentPrompt[]);
        }
        setLoadingAI(false);
      });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-4 border-b border-surface-border">
        <Pressable className="mr-3 active:opacity-60" onPress={() => router.back()}>
          <ChevronLeft size={24} color="#94a3b8" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-slate-400 text-xs mb-0.5">AI Insights</Text>
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {loadingProject ? "Loading…" : (project?.title ?? "Project")}
          </Text>
        </View>
        <Pressable
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border active:opacity-60"
          onPress={() =>
            router.push({ pathname: "/(app)/chat/[id]", params: { id: projectId } })
          }
        >
          <MessageSquare size={14} color="#3b82f6" />
          <Text className="text-primary-400 text-sm font-medium">Chat</Text>
        </Pressable>
      </View>

      {loadingProject ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* BYO-AI banner */}
          <View className="flex-row items-start gap-3 mb-5 p-4 rounded-2xl bg-surface-card border border-surface-border">
            <Zap size={18} color="#f59e0b" />
            <View className="flex-1">
              <Text className="text-white font-semibold text-sm mb-0.5">
                BYO-AI Sub-Agent Prompts
              </Text>
              <Text className="text-slate-500 text-xs leading-4">
                Copy any prompt into ChatGPT, Claude, or Gemini for expert guidance tailored to your project.
              </Text>
            </View>
            {loadingAI && <ActivityIndicator size="small" color="#f59e0b" />}
          </View>

          {/* AI error */}
          {aiError && (
            <View className="mb-4 p-4 rounded-2xl bg-red-950/40 border border-red-800/40">
              <Text className="text-red-400 text-sm mb-3">{aiError}</Text>
              <Pressable
                className="self-start px-3 py-1.5 rounded-lg bg-slate-800 active:opacity-70"
                onPress={retryAI}
              >
                <Text className="text-slate-300 text-sm">Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Loading skeletons */}
          {loadingAI && prompts.length === 0 &&
            [1, 2, 3].map((i) => (
              <View
                key={i}
                className="mb-4 rounded-2xl bg-surface-card border border-surface-border p-4 h-44 items-center justify-center gap-2"
              >
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="text-slate-600 text-xs">Generating prompt {i} of 3…</Text>
              </View>
            ))}

          {/* Prompt cards */}
          {prompts.map((p) => (
            <PromptCard key={p.domain} prompt={p} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
