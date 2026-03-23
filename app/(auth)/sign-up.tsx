import { useState } from "react";
import {
  View, Text, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    setError(null);
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!email.trim()) return setError("Please enter your university email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!agreed) return setError("Please agree to the terms and conditions.");

    try {
      setLoading(true);
      await signUp(email.trim().toLowerCase(), password, fullName.trim());
      router.replace("/(app)/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign-up failed. Please try again.");
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
        <View style={{ marginBottom: vs(32) }}>
          <Text style={{ color: C.white, fontWeight: "800", fontSize: fs(30), marginBottom: vs(8) }}>
            Welcome,
          </Text>
          <Text style={{ color: C.textMuted, fontSize: fs(14), lineHeight: vs(20) }}>
            Please fill up the details below to create an account.
          </Text>
        </View>

        {/* Full Name */}
        <View style={{ marginBottom: vs(16) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>Full Name</Text>
          <TextInput value={fullName} onChangeText={setFullName} autoCapitalize="words" autoCorrect={false} placeholderTextColor={C.textFaint} style={inputStyle} />
        </View>

        {/* University Email */}
        <View style={{ marginBottom: vs(16) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>University Email</Text>
          <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholderTextColor={C.textFaint} style={inputStyle} />
        </View>

        {/* Set Password */}
        <View style={{ marginBottom: vs(16) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>Set Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={C.textFaint} style={inputStyle} />
        </View>

        {/* Confirm Password */}
        <View style={{ marginBottom: vs(16) }}>
          <Text style={{ color: C.white, fontWeight: "600", fontSize: fs(14), marginBottom: vs(8) }}>Confirm Password</Text>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor={C.textFaint} style={inputStyle} />
        </View>

        {/* Terms */}
        <Btn
          onPress={() => setAgreed((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: s(10), marginBottom: vs(24) }}
          pressScale={1}
        >
          <View style={{
            width: s(18), height: s(18), borderRadius: s(4), borderWidth: 1.5,
            borderColor: agreed ? C.pink : "rgba(255,255,255,0.3)",
            backgroundColor: agreed ? C.pink : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {agreed && <Text style={{ color: C.white, fontSize: fs(11), fontWeight: "700" }}>✓</Text>}
          </View>
          <Text style={{ color: C.textMuted, fontSize: fs(13) }}>Agree to the terms and conditions.</Text>
        </Btn>

        {error && (
          <Text style={{ color: C.danger, fontSize: fs(13), marginBottom: vs(14), textAlign: "center" }}>{error}</Text>
        )}

        <GradientBtn onPress={handleSignUp} loading={loading} label="Create Account" style={{ marginBottom: vs(20) }} />

        <Btn onPress={() => router.push("/(auth)/sign-in")} style={{ alignItems: "center" }} pressScale={0.97}>
          <Text style={{ color: C.textMuted, fontSize: fs(13) }}>
            Already have an account?{"  "}
            <Text style={{ color: C.purpleL, fontWeight: "700" }}>Log In.</Text>
          </Text>
        </Btn>
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
} as const;
