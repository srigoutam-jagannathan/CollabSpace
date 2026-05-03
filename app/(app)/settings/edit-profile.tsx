import { useState, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, Camera } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C, FONT, GRADIENT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

type FormState = {
  full_name: string;
  bio: string;
  department: string;
  year_of_study: string;
};

const EMPTY: FormState = { full_name: "", bio: "", department: "", year_of_study: "" };

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13), marginBottom: vs(8), letterSpacing: 0.2 }}>
      {label}
    </Text>
  );
}

export default function EditProfileScreen() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const displayName = form.full_name || user?.user_metadata?.full_name || "?";
  const initials = displayName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const avatarSource = localAvatarUri ?? currentAvatarUrl ?? null;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("full_name, bio, department, year_of_study, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name ?? "",
            bio: data.bio ?? "",
            department: data.department ?? "",
            year_of_study: data.year_of_study != null ? String(data.year_of_study) : "",
          });
          setCurrentAvatarUrl(data.avatar_url ?? null);
        }
        setLoading(false);
      });
  }, [user?.id]);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!user) return;
    const yearRaw = form.year_of_study.trim();
    const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;
    if (yearRaw && (isNaN(yearNum!) || yearNum! < 1 || yearNum! > 8)) {
      Alert.alert("Invalid Year", "Year of study must be a number between 1 and 8.");
      return;
    }
    setSaving(true);
    let avatarUrl = currentAvatarUrl;

    if (localAvatarUri) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No auth token");

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const fileName = `${user.id}.jpg`;

        const formData = new FormData();
        formData.append("file", { uri: localAvatarUri, name: fileName, type: "image/jpeg" } as any);

        const res = await fetch(
          `${supabaseUrl}/storage/v1/object/avatars/${fileName}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "x-upsert": "true" },
            body: formData,
          }
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status}: ${body}`);
        }

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      } catch (e: any) {
        console.error("Avatar upload error:", e);
        Alert.alert("Photo Upload Failed", e?.message ?? "Could not upload photo. Your profile details were saved.");
      }
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          bio: form.bio.trim() || null,
          department: form.department.trim() || null,
          year_of_study: yearNum,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.");
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
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22), marginLeft: s(12) }}>
            Edit Profile
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(48) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar picker */}
          <View style={{ alignItems: "center", marginBottom: vs(32) }}>
            <Pressable onPress={pickAvatar} style={{ position: "relative" }}>
              <LinearGradient
                colors={GRADIENT.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: s(96), height: s(96), borderRadius: s(48), padding: 3 }}
              >
                <View style={{ flex: 1, borderRadius: s(45), backgroundColor: C.bgMid, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  {avatarSource ? (
                    <Image source={{ uri: avatarSource }} style={{ width: "100%", height: "100%", borderRadius: s(45) }} />
                  ) : (
                    <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(28) }}>{initials}</Text>
                  )}
                </View>
              </LinearGradient>

              {/* Camera badge */}
              <View style={{
                position: "absolute", bottom: 2, right: 2,
                width: s(28), height: s(28), borderRadius: s(14),
                backgroundColor: C.purple,
                borderWidth: 2, borderColor: C.bgMid,
                alignItems: "center", justifyContent: "center",
              }}>
                <Camera size={s(13)} color={C.white} strokeWidth={2} />
              </View>
            </Pressable>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(8) }}>
              Tap to change photo
            </Text>
          </View>

          {/* Full Name */}
          <View style={{ marginBottom: vs(20) }}>
            <FieldLabel label="Full Name" />
            <TextInput
              value={form.full_name}
              onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
              placeholderTextColor={C.textFaint}
              placeholder="Your full name"
              style={inputStyle}
            />
          </View>

          {/* Department */}
          <View style={{ marginBottom: vs(20) }}>
            <FieldLabel label="Department / Course" />
            <TextInput
              value={form.department}
              onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
              placeholderTextColor={C.textFaint}
              placeholder="e.g. M.Des User Experience Design"
              style={inputStyle}
            />
          </View>

          {/* Year of Study */}
          <View style={{ marginBottom: vs(20) }}>
            <FieldLabel label="Year of Study" />
            <TextInput
              value={form.year_of_study}
              onChangeText={(v) => setForm((f) => ({ ...f, year_of_study: v }))}
              keyboardType="number-pad"
              maxLength={1}
              placeholderTextColor={C.textFaint}
              placeholder="e.g. 1"
              style={inputStyle}
            />
          </View>

          {/* Bio */}
          <View style={{ marginBottom: vs(32) }}>
            <FieldLabel label="Bio" />
            <TextInput
              value={form.bio}
              onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
              multiline
              numberOfLines={4}
              placeholderTextColor={C.textFaint}
              placeholder="Tell collaborators a bit about yourself…"
              style={[inputStyle, { height: vs(110), textAlignVertical: "top", paddingTop: vs(12) }]}
            />
          </View>

          <GradientBtn onPress={handleSave} loading={saving} label="Save Changes" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: s(10),
  borderWidth: 1,
  borderColor: "rgba(139,92,246,0.3)",
  color: "#ffffff" as const,
  fontSize: fs(15),
  paddingHorizontal: s(16),
  paddingVertical: vs(14),
  height: vs(52),
  fontFamily: FONT.regular,
};
