import { useState } from "react";
import {
  View, Text, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;
      Alert.alert("Password Updated", "Your password has been changed successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password. Please try again.");
    } finally {
      setSaving(false);
    }
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
            Change Password
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(48) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), lineHeight: vs(21), marginBottom: vs(28) }}>
            Enter a new password for your account. It must be at least 8 characters long.
          </Text>

          {/* New Password */}
          <View style={{ marginBottom: vs(18) }}>
            <Text style={labelStyle}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholderTextColor={C.textFaint}
              placeholder="At least 8 characters"
              style={inputStyle}
            />
          </View>

          {/* Confirm Password */}
          <View style={{ marginBottom: vs(28) }}>
            <Text style={labelStyle}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor={C.textFaint}
              placeholder="Re-enter your new password"
              style={inputStyle}
            />
          </View>

          {error && (
            <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(13), marginBottom: vs(16), textAlign: "center" }}>
              {error}
            </Text>
          )}

          <GradientBtn onPress={handleSave} loading={saving} label="Update Password" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const labelStyle = {
  color: "#ffffff" as const,
  fontFamily: FONT.semiBold,
  fontSize: fs(13),
  marginBottom: vs(8),
  letterSpacing: 0.2,
};

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
