import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { GradientBtn } from "@/components/GradientBtn";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";

const ROLES = ["Developer", "Designer", "Marketer", "Legal", "Finance", "Other"];

export default function JoinProjectScreen() {
  const { tokens: { C } } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user || !id) return;
    setLoading(true);

    const { error } = await supabase.from("project_members").insert({
      project_id: id,
      user_id: user.id,
      intro_message: message.trim() || null,
      role: selectedRole || null,
    });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already Applied", "You have already applied to this project.");
      } else {
        Alert.alert("Error", error.message);
      }
      return;
    }

    Alert.alert(
      "Application Sent!",
      "The project owner has been notified.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(60) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: vs(16),
            marginBottom: vs(12),
          }}
        >
          <Text
            style={{
              color: C.white,
              fontFamily: FONT.bold,
              fontSize: fs(20),
            }}
          >
            Join Project
          </Text>

          <Btn
            onPress={() => router.back()}
            hitSlop={12}
            pressScale={0.88}
            style={{ flexDirection: "row", alignItems: "center", gap: s(4) }}
          >
            <ChevronLeft size={s(18)} color={C.textMuted} />
            <Text
              style={{
                color: C.textMuted,
                fontFamily: FONT.medium,
                fontSize: fs(14),
              }}
            >
              Back
            </Text>
          </Btn>
        </View>

        {/* Subtitle */}
        <Text
          style={{
            color: C.textMuted,
            fontFamily: FONT.regular,
            fontSize: fs(13),
            lineHeight: vs(20),
            marginBottom: vs(28),
          }}
        >
          Your profile will be shared with the host once you submit your application
          — no extra work needed!
        </Text>

        {/* Role section */}
        <Text
          style={{
            color: C.white,
            fontFamily: FONT.semiBold,
            fontSize: fs(15),
            marginBottom: vs(10),
          }}
        >
          Your Role
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: s(8) }}
        >
          {ROLES.map((role) => {
            const isSelected = selectedRole === role;
            return (
              <Btn
                key={role}
                onPress={() => setSelectedRole(isSelected ? "" : role)}
                pressScale={0.93}
                style={{ marginRight: s(8) }}
              >
                <View style={{
                  borderRadius: s(20),
                  paddingHorizontal: s(16),
                  paddingVertical: vs(8),
                  backgroundColor: isSelected ? C.pink : "transparent",
                  borderWidth: 1.5,
                  borderColor: isSelected ? C.pink : C.border,
                }}>
                  <Text style={{
                    color: isSelected ? C.white : C.textMuted,
                    fontFamily: isSelected ? FONT.semiBold : FONT.regular,
                    fontSize: fs(13),
                  }}>
                    {role}
                  </Text>
                </View>
              </Btn>
            );
          })}
        </ScrollView>

        {/* Intro message section */}
        <Text
          style={{
            color: C.white,
            fontFamily: FONT.semiBold,
            fontSize: fs(15),
            marginTop: vs(24),
            marginBottom: vs(10),
          }}
        >
          Intro Message
        </Text>

        <TextInput
          value={message}
          onChangeText={(t) => setMessage(t.slice(0, 500))}
          placeholder="Tell them why you're the right fit for this project…"
          placeholderTextColor={C.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            height: vs(140),
            backgroundColor: C.fieldBg,
            borderRadius: s(14),
            padding: s(16),
            color: C.white,
            fontSize: fs(14),
            fontFamily: FONT.regular,
            borderWidth: 1,
            borderColor: "rgba(192,133,82,0.22)",
          }}
        />

        <Text
          style={{
            color: C.textFaint,
            fontFamily: FONT.regular,
            fontSize: fs(11),
            textAlign: "right",
            marginTop: vs(6),
          }}
        >
          {message.length} / 500
        </Text>

        {/* Submit */}
        <View style={{ marginTop: vs(32) }}>
          <GradientBtn
            label="Submit Application"
            onPress={handleSubmit}
            loading={loading}
            disabled={!message.trim() && !selectedRole}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
