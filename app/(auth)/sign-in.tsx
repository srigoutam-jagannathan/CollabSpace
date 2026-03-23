import { useState } from "react";
import {
  View, Text, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

export default function SignInScreen() {
  const { signInWithPassword, devSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Please enter your university email and password.");
      return;
    }
    try {
      setError(null);
      setLoading(true);
      await signInWithPassword(email.trim().toLowerCase(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: s(28), paddingVertical: vs(40) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Btn
          onPress={() => router.navigate("/(auth)/onboarding" as any)}
          style={{ position: "absolute", top: vs(16), right: s(20) }}
          hitSlop={16}
          pressScale={0.9}
        >
          <Text style={{ color: C.textMuted, fontSize: fs(14) }}>‹ Back</Text>
        </Btn>

        {/* Header */}
        <View style={{ marginBottom: vs(36) }}>
          <Text style={{ color: C.white, fontWeight: "800", fontSize: fs(30), marginBottom: vs(8) }}>
            Welcome Back,
          </Text>
          <Text style={{ color: C.textMuted, fontSize: fs(14), lineHeight: vs(20) }}>
            Please enter your details below to log into your account.
          </Text>
        </View>

        {/* University Email */}
        <View style={{ marginBottom: vs(18) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>
            University Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={C.textFaint}
            style={inputStyle}
          />
        </View>

        {/* Password */}
        <View style={{ marginBottom: vs(14) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={C.textFaint}
            style={inputStyle}
          />
        </View>

        {/* Remember Me */}
        <Btn
          onPress={() => setRememberMe((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: s(10), marginBottom: vs(28) }}
          pressScale={1}
        >
          <View style={{
            width: s(18), height: s(18), borderRadius: s(4), borderWidth: 1.5,
            borderColor: rememberMe ? C.pink : "rgba(255,255,255,0.3)",
            backgroundColor: rememberMe ? C.pink : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {rememberMe && <Text style={{ color: C.white, fontSize: fs(11), fontWeight: "700" }}>✓</Text>}
          </View>
          <Text style={{ color: C.textMuted, fontSize: fs(13) }}>Remember Me.</Text>
        </Btn>

        {error && (
          <Text style={{ color: C.danger, fontSize: fs(13), marginBottom: vs(16), textAlign: "center" }}>
            {error}
          </Text>
        )}

        {/* Log In */}
        <GradientBtn
          onPress={handleSignIn}
          loading={loading}
          label="Log In"
          style={{ marginBottom: vs(20) }}
        />

        {/* Sign up link */}
        <Btn onPress={() => router.push("/(auth)/sign-up")} style={{ alignItems: "center" }} pressScale={0.97}>
          <Text style={{ color: C.textMuted, fontSize: fs(13) }}>
            Don't have an account?{"  "}
            <Text style={{ color: C.purpleL, fontWeight: "700" }}>Create Account.</Text>
          </Text>
        </Btn>

        {/* DEV ONLY */}
        {__DEV__ && devSignIn && (
          <View style={{ alignItems: "center", marginTop: vs(64), paddingBottom: vs(8) }}>
            <Btn
              onPress={async () => {
                await AsyncStorage.setItem("skills_set", "true");
                devSignIn();
              }}
              style={{
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                borderRadius: s(8), paddingHorizontal: s(20), paddingVertical: vs(10),
              }}
              pressScale={0.94}
            >
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: fs(12) }}>DEV: Skip login</Text>
            </Btn>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
};
