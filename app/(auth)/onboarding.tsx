import { useRef, useEffect } from "react";
import { Image, View, Text, useWindowDimensions, Animated, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();

  // Continuous slow clockwise rotation
  const spinAnim = useRef(new Animated.Value(0)).current;
  // Bounce on touch (scale)
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 12000, // one full rotation every 12 seconds
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  function handleLogoPress() {
    Animated.sequence([
      Animated.spring(bounceScale, {
        toValue: 0.82,
        useNativeDriver: true,
        speed: 80,
        bounciness: 0,
      }),
      Animated.spring(bounceScale, {
        toValue: 1.18,
        useNativeDriver: true,
        speed: 28,
        bounciness: 18,
      }),
      Animated.spring(bounceScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 22,
        bounciness: 12,
      }),
    ]).start();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(32), paddingTop: vs(60), paddingBottom: vs(48) }}>

        {/* ── Logo + branding ── */}
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <Pressable onPress={handleLogoPress} hitSlop={20}>
            <Animated.View style={{
              width: width * 0.48,
              height: width * 0.48,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: vs(28),
              transform: [{ rotate: spin }, { scale: bounceScale }],
            }}>
              <Image
                source={require("../../assets/collabspace-logo.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>

          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(34), letterSpacing: -0.5, marginBottom: vs(10) }}>
            CollabSpace
          </Text>

          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(15), textAlign: "center", lineHeight: vs(22) }}>
            Connect with students.{"\n"}Collaborate on projects. Create together.
          </Text>
        </View>

        {/* ── Action buttons ── */}
        <View style={{ width: "100%", gap: vs(14) }}>
          <GradientBtn
            label="Log In"
            onPress={() => router.push("/(auth)/sign-in")}
          />

          <Btn
            onPress={() => router.push("/(auth)/sign-up")}
            pressScale={0.97}
            style={{ borderRadius: s(32), overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(200,54,160,0.4)" }}
          >
            <View style={{ paddingVertical: vs(16), alignItems: "center" }}>
              <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16) }}>Create Account</Text>
            </View>
          </Btn>

          <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12), textAlign: "center", marginTop: vs(4) }}>
            Only open to QUB and Ulster University students
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
