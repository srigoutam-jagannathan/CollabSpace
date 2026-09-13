import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, Copy, Check, Scale, Cpu, Megaphone, Zap, MessageSquare } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";
import type { Project } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubAgentPrompt {
  domain: "legal" | "tech" | "marketing";
  label: string;
  system_prompt: string;
  starter_question: string;
}

type DomainMeta = {
  icon: typeof Scale;
  accentColor: string;
  bgColor: string;
  borderColor: string;
};

const DOMAIN_META: Record<SubAgentPrompt["domain"], DomainMeta> = {
  legal: {
    icon: Scale,
    accentColor: "#f5a623",
    bgColor: "rgba(245,166,35,0.08)",
    borderColor: "rgba(245,166,35,0.22)",
  },
  tech: {
    icon: Cpu,
    accentColor: "#c08552",
    bgColor: "rgba(192,133,82,0.08)",
    borderColor: "rgba(192,133,82,0.22)",
  },
  marketing: {
    icon: Megaphone,
    accentColor: "#52c0a8",
    bgColor: "rgba(82,192,168,0.08)",
    borderColor: "rgba(82,192,168,0.20)",
  },
};

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({ prompt }: { prompt: SubAgentPrompt }) {
  const { tokens: { C } } = useTheme();
  const [copied, setCopied] = useState(false);
  const meta = DOMAIN_META[prompt.domain];
  const Icon = meta.icon;

  async function handleCopy() {
    await Clipboard.setStringAsync(prompt.system_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={{
      marginBottom: vs(12),
      borderRadius: s(16),
      borderWidth: 1,
      borderColor: meta.borderColor,
      backgroundColor: meta.bgColor,
      overflow: "hidden",
    }}>
      {/* Card header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: s(14), paddingTop: vs(12), paddingBottom: vs(10),
        borderBottomWidth: 1, borderBottomColor: meta.borderColor,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
          <View style={{
            width: s(30), height: s(30), borderRadius: s(8),
            backgroundColor: `${meta.accentColor}18`,
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={s(15)} color={meta.accentColor} strokeWidth={1.8} />
          </View>
          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14) }}>
            {prompt.label}
          </Text>
        </View>

        <Btn onPress={handleCopy} pressScale={0.9} debounceMs={0}>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: s(5),
            paddingHorizontal: s(10), paddingVertical: vs(5),
            borderRadius: s(8),
            backgroundColor: copied ? "rgba(82,192,168,0.12)" : C.surface,
            borderWidth: 1,
            borderColor: copied ? "rgba(82,192,168,0.30)" : C.border,
          }}>
            {copied
              ? <Check size={s(12)} color="#52c0a8" strokeWidth={2.5} />
              : <Copy size={s(12)} color={C.textMuted} strokeWidth={1.8} />}
            <Text style={{
              color: copied ? "#52c0a8" : C.textMuted,
              fontFamily: FONT.semiBold,
              fontSize: fs(12),
            }}>
              {copied ? "Copied!" : "Copy"}
            </Text>
          </View>
        </Btn>
      </View>

      {/* Prompt preview */}
      <View style={{ paddingHorizontal: s(14), paddingTop: vs(10), paddingBottom: vs(10) }}>
        <Text style={{
          color: C.textMuted,
          fontFamily: FONT.regular,
          fontSize: fs(13),
          lineHeight: vs(20),
          marginBottom: vs(10),
        }} numberOfLines={5}>
          {prompt.system_prompt}
        </Text>

        {/* Starter question */}
        <View style={{
          backgroundColor: "rgba(255,248,240,0.04)",
          borderRadius: s(10),
          borderWidth: 1,
          borderColor: C.border,
          padding: s(12),
        }}>
          <Text style={{
            color: C.textFaint,
            fontFamily: FONT.semiBold,
            fontSize: fs(10),
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: vs(4),
          }}>
            Starter Question
          </Text>
          <Text style={{
            color: C.textMuted,
            fontFamily: FONT.regular,
            fontSize: fs(13),
            fontStyle: "italic",
            lineHeight: vs(19),
          }}>
            {prompt.starter_question}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Project Insights ─────────────────────────────────────────────────────────

export default function ProjectInsights({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { tokens: { C } } = useTheme();
  const [project, setProject] = useState<Project | null>(null);
  const [prompts, setPrompts] = useState<SubAgentPrompt[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  function retryAI() {
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
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: s(16), paddingTop: vs(8), paddingBottom: vs(14),
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Btn onPress={() => router.back()} pressScale={0.9} hitSlop={12} style={{ marginRight: s(10) }}>
          <ChevronLeft size={s(22)} color={C.textMuted} strokeWidth={2} />
        </Btn>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11) }}>AI Insights</Text>
          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15) }} numberOfLines={1}>
            {loadingProject ? "Loading…" : (project?.title ?? "Project")}
          </Text>
        </View>
        <Btn
          onPress={() => router.push({ pathname: "/(app)/chat/[id]", params: { id: projectId } })}
          pressScale={0.9}
        >
          <View style={{
            flexDirection: "row", alignItems: "center", gap: s(6),
            paddingHorizontal: s(12), paddingVertical: vs(7),
            borderRadius: s(10),
            backgroundColor: C.surface,
            borderWidth: 1, borderColor: C.border,
          }}>
            <MessageSquare size={s(14)} color={C.purple} strokeWidth={1.8} />
            <Text style={{ color: C.purple, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Chat</Text>
          </View>
        </Btn>
      </View>

      {loadingProject ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.purple} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: s(16), paddingBottom: vs(48) }}
          showsVerticalScrollIndicator={false}
        >
          {/* BYO-AI banner */}
          <View style={{
            flexDirection: "row", alignItems: "flex-start", gap: s(12),
            marginBottom: vs(20),
            padding: s(14),
            borderRadius: s(14),
            backgroundColor: "rgba(245,166,35,0.07)",
            borderWidth: 1, borderColor: "rgba(245,166,35,0.20)",
          }}>
            <Zap size={s(18)} color="#f5a623" strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13), marginBottom: vs(3) }}>
                BYO-AI Sub-Agent Prompts
              </Text>
              <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12), lineHeight: vs(17) }}>
                Copy any prompt into ChatGPT, Claude, or Gemini for expert guidance tailored to your project.
              </Text>
            </View>
            {loadingAI && <ActivityIndicator size="small" color="#f5a623" />}
          </View>

          {/* AI error */}
          {aiError && (
            <View style={{
              marginBottom: vs(16), padding: s(14),
              borderRadius: s(14),
              backgroundColor: "rgba(248,113,113,0.08)",
              borderWidth: 1, borderColor: "rgba(248,113,113,0.22)",
            }}>
              <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(13), marginBottom: vs(10) }}>
                {aiError}
              </Text>
              <Btn onPress={retryAI} pressScale={0.94} style={{ alignSelf: "flex-start" }}>
                <View style={{
                  paddingHorizontal: s(12), paddingVertical: vs(6),
                  borderRadius: s(8),
                  backgroundColor: C.surface,
                  borderWidth: 1, borderColor: C.border,
                }}>
                  <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Retry</Text>
                </View>
              </Btn>
            </View>
          )}

          {/* Loading skeletons */}
          {loadingAI && prompts.length === 0 && [1, 2, 3].map((i) => (
            <View key={i} style={{
              marginBottom: vs(12),
              borderRadius: s(16),
              backgroundColor: C.surface,
              borderWidth: 1, borderColor: C.border,
              height: vs(160),
              alignItems: "center", justifyContent: "center", gap: s(8),
            }}>
              <ActivityIndicator size="small" color={C.purple} />
              <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12) }}>
                Generating prompt {i} of 3…
              </Text>
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
