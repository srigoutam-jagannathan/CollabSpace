import { useState, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, X, Plus, Globe, Type } from "lucide-react-native";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

type PortfolioLink = { title: string; url: string };

export default function PortfolioLinksScreen() {
  const { tokens: { C } } = useTheme();
  const { user } = useAuth();
  const [links, setLinks] = useState<PortfolioLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("portfolio_links")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const raw = (data as any)?.portfolio_links;
        setLinks(Array.isArray(raw) && raw.length > 0 ? raw : []);
        setLoading(false);
      });
  }, [user?.id]);

  function updateLink(index: number, field: keyof PortfolioLink, value: string) {
    setLinks((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function addLink() {
    setLinks((prev) => [...prev, { title: "", url: "" }]);
  }

  async function handleSave() {
    if (!user) return;
    const cleaned = links
      .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
      .filter((l) => l.title || l.url);

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ portfolio_links: cleaned, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save portfolio links. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(20) }}>
          <Btn onPress={() => router.back()} pressScale={0.9} hitSlop={12}>
            <ChevronLeft size={s(22)} color={C.textMuted} strokeWidth={2} />
          </Btn>
          <View style={{ marginLeft: s(12) }}>
            <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22) }}>
              Portfolio Links
            </Text>
            <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(1) }}>
              {links.length === 0 ? "No links added" : `${links.length} link${links.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(48) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Empty state */}
          {links.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: vs(40) }}>
              <View style={{
                width: s(64), height: s(64), borderRadius: s(32),
                backgroundColor: "rgba(192,133,82,0.10)",
                borderWidth: 1, borderColor: "rgba(192,133,82,0.20)",
                alignItems: "center", justifyContent: "center",
                marginBottom: vs(16),
              }}>
                <Globe size={s(28)} color={C.purple} strokeWidth={1.5} />
              </View>
              <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(16), marginBottom: vs(6) }}>
                No portfolio links yet
              </Text>
              <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13), textAlign: "center", lineHeight: vs(20) }}>
                Add links to your Behance, GitHub, personal site, or any other work you want to showcase.
              </Text>
            </View>
          )}

          {/* Link cards */}
          {links.length > 0 && (
            <View style={{ gap: vs(12), marginBottom: vs(8) }}>
              {links.map((link, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: C.surface,
                    borderRadius: s(16),
                    borderWidth: 1,
                    borderColor: C.border,
                    overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: s(14), paddingTop: vs(12), paddingBottom: vs(10),
                    borderBottomWidth: 1, borderBottomColor: C.border,
                  }}>
                    <View style={{
                      width: s(22), height: s(22), borderRadius: s(6),
                      backgroundColor: "rgba(192,133,82,0.18)",
                      alignItems: "center", justifyContent: "center",
                      marginRight: s(8),
                    }}>
                      <Text style={{ color: C.purple, fontFamily: FONT.bold, fontSize: fs(10) }}>
                        {String(i + 1).padStart(2, "0")}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, color: link.title ? C.white : C.textFaint, fontFamily: FONT.semiBold, fontSize: fs(13) }} numberOfLines={1}>
                      {link.title || "Untitled link"}
                    </Text>
                    <Btn onPress={() => removeLink(i)} pressScale={0.88} hitSlop={10}>
                      <View style={{
                        width: s(28), height: s(28), borderRadius: s(14),
                        backgroundColor: "rgba(248,113,113,0.10)",
                        borderWidth: 1, borderColor: "rgba(248,113,113,0.22)",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <X size={s(12)} color="rgba(248,113,113,0.9)" strokeWidth={2.5} />
                      </View>
                    </Btn>
                  </View>

                  {/* Fields */}
                  <View style={{ paddingHorizontal: s(14), paddingTop: vs(12), paddingBottom: vs(14), gap: vs(12) }}>
                    {/* Title */}
                    <View style={{
                      flexDirection: "row", alignItems: "center",
                      backgroundColor: C.fieldBg, borderRadius: s(10),
                      borderWidth: 1, borderColor: C.border,
                      paddingHorizontal: s(12),
                    }}>
                      <Type size={s(14)} color={C.textMuted} strokeWidth={1.8} style={{ marginRight: s(8) }} />
                      <TextInput
                        value={link.title}
                        onChangeText={(v) => updateLink(i, "title", v)}
                        placeholder="e.g. Design Portfolio"
                        placeholderTextColor={C.textFaint}
                        maxLength={60}
                        returnKeyType="next"
                        style={{
                          flex: 1,
                          color: C.white,
                          fontSize: fs(14),
                          paddingVertical: vs(11),
                          fontFamily: FONT.regular,
                        }}
                      />
                    </View>

                    {/* URL */}
                    <View style={{
                      flexDirection: "row", alignItems: "center",
                      backgroundColor: C.fieldBg, borderRadius: s(10),
                      borderWidth: 1, borderColor: C.border,
                      paddingHorizontal: s(12),
                    }}>
                      <Globe size={s(14)} color={C.textMuted} strokeWidth={1.8} style={{ marginRight: s(8) }} />
                      <TextInput
                        value={link.url}
                        onChangeText={(v) => updateLink(i, "url", v)}
                        placeholder="https://..."
                        placeholderTextColor={C.textFaint}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        style={{
                          flex: 1,
                          color: C.white,
                          fontSize: fs(14),
                          paddingVertical: vs(11),
                          fontFamily: FONT.regular,
                        }}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add link button */}
          <Btn onPress={addLink} pressScale={0.97} style={{ marginTop: vs(16) }}>
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(8),
              borderRadius: s(14),
              borderWidth: 1,
              borderColor: "rgba(192,133,82,0.35)",
              borderStyle: "dashed",
              paddingVertical: vs(15),
            }}>
              <View style={{
                width: s(22), height: s(22), borderRadius: s(11),
                backgroundColor: "rgba(192,133,82,0.18)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Plus size={s(12)} color={C.purple} strokeWidth={2.5} />
              </View>
              <Text style={{ color: C.purple, fontFamily: FONT.semiBold, fontSize: fs(14) }}>
                Add Portfolio Link
              </Text>
            </View>
          </Btn>

          {/* Divider before save */}
          <View style={{ height: 1, backgroundColor: C.border, marginTop: vs(28), marginBottom: vs(24) }} />

          <GradientBtn onPress={handleSave} loading={saving} label="Save Changes" />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
