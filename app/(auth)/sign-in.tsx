import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C, FONT } from "@/utils/theme";
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
        {/* Header — centred */}
        <View style={{ alignItems: "center", marginBottom: vs(40), marginTop: vs(20) }}>
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(30), letterSpacing: -0.5, marginBottom: vs(10), textAlign: "center" }}>
            Welcome Back
          </Text>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), lineHeight: vs(21), textAlign: "center", maxWidth: s(280) }}>
            Enter your university credentials to continue
          </Text>
        </View>

        {/* University Email */}
        <View style={{ marginBottom: vs(18) }}>
          <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13), marginBottom: vs(8), letterSpacing: 0.2 }}>
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
        <View style={{ marginBottom: vs(18) }}>
          <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(13), marginBottom: vs(8), letterSpacing: 0.2 }}>
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

        {/* Remember Me — inline row */}
        <Pressable
          onPress={() => setRememberMe((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: s(10), marginBottom: vs(28), alignSelf: "flex-start" }}
        >
          <View style={{
            width: s(20), height: s(20), borderRadius: s(5), borderWidth: 1.5,
            borderColor: rememberMe ? C.pink : "rgba(255,255,255,0.28)",
            backgroundColor: rememberMe ? C.pink : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {rememberMe && <Text style={{ color: C.white, fontSize: fs(12), fontFamily: FONT.bold, lineHeight: fs(14) }}>✓</Text>}
          </View>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>Remember me</Text>
        </Pressable>

        {error && (
          <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(13), marginBottom: vs(16), textAlign: "center" }}>
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
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
            Don't have an account?{"  "}
            <Text style={{ color: C.purpleL, fontFamily: FONT.bold }}>Create Account.</Text>
          </Text>
        </Btn>

        {/* DEV ONLY */}
        {__DEV__ && devSignIn && (
          <View style={{ alignItems: "center", marginTop: vs(32), paddingBottom: vs(8) }}>
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

        {/* Back button — bottom-centre */}
        <Pressable
          onPress={() => router.navigate("/(auth)/onboarding" as any)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(4), marginTop: vs(28), paddingBottom: vs(4) }}
        >
          <ChevronLeft size={s(16)} color={C.textFaint} strokeWidth={2} />
          <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(13) }}>Back</Text>
        </Pressable>
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
