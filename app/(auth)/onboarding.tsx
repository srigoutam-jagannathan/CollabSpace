import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, Animated, Easing,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  useWindowDimensions, Alert, Keyboard, LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Mail, Lock, UserRound, LockKeyhole, Check,
  Palette, Code2, Briefcase, Trophy, Plus,
} from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { Btn } from "@/components/Btn";
import { GradientBtn } from "@/components/GradientBtn";
import { PremiumInput } from "@/components/PremiumInput";
import { StepProgressBar } from "@/components/StepProgressBar";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { useEntrance } from "@/utils/useEntrance";
import { useShake } from "@/utils/useShake";
import { haptic } from "@/utils/haptics";

// ─── Skill data ────────────────────────────────────────────────────────────────

const SKILL_CATEGORIES = [
  { title: "CREATIVE AND ARTS", icon: Palette, skills: ["Design", "Visual Arts", "Film and Media", "Game", "Performing Arts", "Writing and Storytelling", "Music", "Animation"] },
  { title: "TECH AND DIGITAL", icon: Code2, skills: ["Coding and Development", "UI/UX", "Cybersecurity", "AI", "Data and Robotics", "VR/AR", "Blockchain"] },
  { title: "BUSINESS AND INNOVATION", icon: Briefcase, skills: ["Entrepreneurship", "Marketing", "Finance", "Social Media", "Content Creation"] },
  { title: "SPORTS AND LIFESTYLE", icon: Trophy, skills: ["Sports and Fitness", "Esports", "Travel and Adventure", "Cooking and Culinary Arts"] },
];

// ─── Password strength ─────────────────────────────────────────────────────────

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; pct: number } {
  if (pw.length === 0) return { level: 0, label: "", pct: 0 };
  const hasLetterAndNumber = /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (pw.length >= 12 && hasLetterAndNumber && hasSpecial) return { level: 3, label: "Strong", pct: 1 };
  if (pw.length >= 8 && hasLetterAndNumber) return { level: 2, label: "Fair", pct: 0.66 };
  return { level: 1, label: "Weak", pct: 0.33 };
}

// ─── useSectionReveal ──────────────────────────────────────────────────────────
// Scrolls the new section into view then fires `active = true` to trigger
// per-element stagger via useEntrance inside the section.

function useSectionReveal(
  scrollViewRef: React.RefObject<ScrollView | null>,
  onY?: (y: number) => void
) {
  const hasRevealed = useRef(false);
  const [active, setActive] = useState(false);

  function onLayout(e: LayoutChangeEvent) {
    if (hasRevealed.current) return;
    hasRevealed.current = true;
    const y = e.nativeEvent.layout.y;
    onY?.(y);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - vs(16)), animated: true });
    // Fire immediately — section is off-screen when onLayout runs, so the
    // stagger animation plays during the scroll and content is visible on arrival.
    setTimeout(() => setActive(true), 0);
  }

  return { onLayout, active };
}

// ─── SkillChip ─────────────────────────────────────────────────────────────────

function SkillChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { tokens: { C } } = useTheme();
  return (
    <Btn onPress={onPress} pressScale={0.93}>
      <View style={{
        paddingHorizontal: s(14), paddingVertical: vs(8), borderRadius: s(20),
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? C.purpleL : C.borderSubtle,
        backgroundColor: selected ? "rgba(192,133,82,0.20)" : "rgba(255,248,240,0.04)",
      }}>
        <Text style={{ color: selected ? C.white : C.textMuted, fontFamily: selected ? FONT.bold : FONT.regular, fontSize: fs(13) }}>
          {label}
        </Text>
      </View>
    </Btn>
  );
}

// ─── WelcomeSection ────────────────────────────────────────────────────────────

function WelcomeSection({
  switchTo,
  parallaxY,
}: {
  switchTo: (c: "signin" | "signup") => void;
  parallaxY: Animated.AnimatedInterpolation<string | number>;
}) {
  const { tokens: { C } } = useTheme();
  const { width, height } = useWindowDimensions();
  const anim = useEntrance(5, 90);
  const bounceScale = useRef(new Animated.Value(1)).current;

  function handleLogoPress() {
    Animated.sequence([
      Animated.spring(bounceScale, { toValue: 0.82, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(bounceScale, { toValue: 1.18, useNativeDriver: true, speed: 28, bounciness: 18 }),
      Animated.spring(bounceScale, { toValue: 1.0, useNativeDriver: true, speed: 22, bounciness: 12 }),
    ]).start();
  }

  return (
    <View style={{ minHeight: height }}>
      <Animated.View style={{
        minHeight: height,
        paddingHorizontal: s(32),
        paddingTop: vs(60),
        paddingBottom: vs(48),
        justifyContent: "space-between",
        transform: [{ translateY: parallaxY as any }],
      }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={anim[0]}>
            <Pressable onPress={handleLogoPress} hitSlop={20}>
              <Animated.View style={{ transform: [{ scale: bounceScale }] }}>
                <Image
                  source={require("../../assets/collabspace-logo.png")}
                  style={{ width: width * 0.36, height: width * 0.36 }}
                  resizeMode="contain"
                />
              </Animated.View>
            </Pressable>
          </Animated.View>

          <Animated.View style={[anim[1], { marginTop: vs(20) }]}>
            <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(38), letterSpacing: -0.5, textAlign: "center" }}>
              CollabSpace
            </Text>
          </Animated.View>

          <Animated.View style={[anim[2], { marginTop: vs(10) }]}>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(16), textAlign: "center", lineHeight: vs(26), maxWidth: s(270) }}>
              {"Connect with students.\nCollaborate on projects.\nCreate together."}
            </Text>
          </Animated.View>
        </View>

        <View style={{ width: "100%" }}>
          <Animated.View style={anim[3]}>
            <GradientBtn label="Log In" onPress={() => switchTo("signin")} />
          </Animated.View>

          <Animated.View style={[anim[4], { marginTop: vs(12) }]}>
            <Btn onPress={() => switchTo("signup")} pressScale={0.97}>
              <View style={{
                height: vs(56), borderRadius: s(16), borderWidth: 1,
                borderColor: C.borderBright, backgroundColor: "rgba(255,248,240,0.06)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(16) }}>Create Account</Text>
              </View>
            </Btn>
          </Animated.View>

          <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(12), textAlign: "center", marginTop: vs(20) }}>
            Only for QUB and Ulster University students
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── SignInSection ─────────────────────────────────────────────────────────────

function SignInSection({
  scrollRef,
  onStoreY,
  onSwitchToSignUp,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  onStoreY: (y: number) => void;
  onSwitchToSignUp: () => void;
}) {
  const { tokens: { C } } = useTheme();
  const { height } = useWindowDimensions();
  const { signInWithPassword, devSignIn } = useAuth();
  const { onLayout, active } = useSectionReveal(scrollRef, onStoreY);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const anim = useEntrance(4, 75, active);
  const { x: shakeX, shake } = useShake();
  const checkScale = useRef(new Animated.Value(1)).current;

  function toggleRemember() {
    haptic.light();
    setRememberMe(v => !v);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 0.78, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(checkScale, { toValue: 1.08, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true, speed: 40, bounciness: 4 }),
    ]).start();
  }

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Please enter your university email and password.");
      shake(); haptic.error(); return;
    }
    try {
      setError(null); setLoading(true); haptic.medium();
      await signInWithPassword(email.trim().toLowerCase(), password);
      haptic.success();
    } catch (e: unknown) {
      shake(); haptic.error();
      setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ minHeight: height }} onLayout={onLayout}>
      <Animated.View style={{
        paddingHorizontal: s(28),
        paddingTop: vs(40),
        paddingBottom: vs(48),
      }}>
        {/* anim[0]: header */}
        <Animated.View style={anim[0]}>
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(36), lineHeight: vs(44), letterSpacing: -0.5 }}>
            Welcome back.
          </Text>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(16), marginTop: vs(8), lineHeight: vs(24) }}>
            Sign in to continue.
          </Text>
        </Animated.View>

        {/* anim[1]: inputs */}
        <Animated.View style={[anim[1], { transform: [{ translateX: shakeX }], marginTop: vs(24) }]}>
          <PremiumInput
            label="University Email" value={email} onChangeText={setEmail}
            icon={Mail} keyboardType="email-address" autoCapitalize="none"
            returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()}
            error={!!error}
          />
          <PremiumInput
            label="Password" value={password} onChangeText={setPassword}
            icon={Lock} secureTextEntry returnKeyType="done"
            onSubmitEditing={handleSignIn} inputRef={passwordRef} error={!!error}
          />
        </Animated.View>

        {/* anim[2]: remember me row + error */}
        <Animated.View style={[anim[2], { marginTop: vs(4) }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={toggleRemember} style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <View style={{
                  width: s(20), height: s(20), borderRadius: s(5), borderWidth: 1.5,
                  borderColor: rememberMe ? C.purpleL : C.borderBright,
                  backgroundColor: rememberMe ? C.purpleL : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {rememberMe && <Text style={{ color: C.bgDeep, fontSize: fs(12), fontFamily: FONT.bold, lineHeight: fs(14) }}>✓</Text>}
                </View>
              </Animated.View>
              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>Remember me</Text>
            </Pressable>
            <Btn pressScale={0.94} onPress={() => {}}>
              <Text style={{ color: C.purpleL, fontFamily: FONT.regular, fontSize: fs(13) }}>Forgot password?</Text>
            </Btn>
          </View>
          {error && (
            <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(12) }}>
              {error}
            </Text>
          )}
        </Animated.View>

        {/* anim[3]: CTA — follows content naturally */}
        <Animated.View style={[anim[3], { marginTop: vs(32) }]}>
          <GradientBtn onPress={handleSignIn} loading={loading} label="Sign In" />
          <Btn onPress={onSwitchToSignUp} style={{ alignItems: "center", marginTop: vs(18) }} pressScale={0.97}>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
              New here?{"  "}<Text style={{ color: C.purpleL, fontFamily: FONT.semiBold }}>Create an account</Text>
            </Text>
          </Btn>
          {__DEV__ && devSignIn && (
            <Btn
              onPress={async () => { await AsyncStorage.setItem("skills_set", "true"); devSignIn(); }}
              style={{ alignItems: "center", marginTop: vs(20) }} pressScale={0.94}
            >
              <Text style={{ color: C.textFaint, fontSize: fs(12) }}>DEV: Skip login</Text>
            </Btn>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── SignUpSection ─────────────────────────────────────────────────────────────

function SignUpSection({
  scrollRef,
  onStoreY,
  onSuccess,
  onSwitchToSignIn,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  onStoreY: (y: number) => void;
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}) {
  const { tokens: { C, GLASS } } = useTheme();
  const { height } = useWindowDimensions();
  const { signUp } = useAuth();
  const { onLayout, active } = useSectionReveal(scrollRef, onStoreY);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const anim = useEntrance(5, 75, active);
  const { x: shakeX, shake } = useShake();
  const checkScale = useRef(new Animated.Value(1)).current;

  const strength = getStrength(password);
  const strengthColors: Record<number, string> = { 0: "transparent", 1: C.danger, 2: "#f59e0b", 3: C.success };
  const strengthColor = strengthColors[strength.level];
  const strengthWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(strengthWidth, { toValue: strength.pct, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [strength.pct]);

  const allValid = fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && confirmPassword.length > 0 && agreed;
  const ctaOpacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    Animated.timing(ctaOpacity, { toValue: allValid ? 1 : 0.45, duration: 200, useNativeDriver: true }).start();
  }, [allValid]);

  function toggleAgreed() {
    haptic.light();
    setAgreed(v => !v);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 0.78, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(checkScale, { toValue: 1.08, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true, speed: 40, bounciness: 4 }),
    ]).start();
  }

  async function handleSignUp() {
    if (!fullName.trim()) { setError("Please enter your full name."); shake(); haptic.error(); return; }
    if (!email.trim()) { setError("Please enter your university email."); shake(); haptic.error(); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); shake(); haptic.error(); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); shake(); haptic.error(); return; }
    if (!agreed) { setError("Please agree to the terms and conditions."); shake(); haptic.error(); return; }
    try {
      setError(null); setLoading(true); haptic.medium();
      await signUp(email.trim().toLowerCase(), password, fullName.trim());
      haptic.success();
      Keyboard.dismiss();
      onSuccess();
    } catch (e: unknown) {
      shake(); haptic.error();
      setError(e instanceof Error ? e.message : "Sign-up failed. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ minHeight: height }} onLayout={onLayout}>
      <Animated.View style={{
        paddingHorizontal: s(28),
        paddingTop: vs(32),
        paddingBottom: vs(48),
      }}>
        {/* anim[0]: StepProgressBar + header */}
        <Animated.View style={anim[0]}>
          <StepProgressBar step={1} totalSteps={2} />
          <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(36), lineHeight: vs(44), letterSpacing: -0.5, marginTop: vs(24) }}>
            Create account.
          </Text>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(16), marginTop: vs(8), lineHeight: vs(24) }}>
            Join QUB and Ulster's student network.
          </Text>
        </Animated.View>

        {/* anim[1]: name + email */}
        <Animated.View style={[anim[1], { transform: [{ translateX: shakeX }], marginTop: vs(20) }]}>
          <PremiumInput label="Full Name" value={fullName} onChangeText={setFullName} icon={UserRound} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
          <PremiumInput label="University Email" value={email} onChangeText={setEmail} icon={Mail} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} inputRef={emailRef} />
        </Animated.View>

        {/* anim[2]: password + strength bar + confirm */}
        <Animated.View style={anim[2]}>
          <PremiumInput label="Password" value={password} onChangeText={setPassword} icon={Lock} secureTextEntry returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} inputRef={passwordRef} />
          {password.length > 0 && (
            <View style={{ marginTop: vs(-4), marginBottom: vs(10) }}>
              <View style={{ height: vs(3), backgroundColor: C.borderSubtle, borderRadius: s(2), overflow: "hidden" }}>
                <Animated.View style={{ height: "100%", borderRadius: s(2), backgroundColor: strengthColor, width: strengthWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
              </View>
              <Text style={{ color: strengthColor, fontFamily: FONT.regular, fontSize: fs(11), textAlign: "right", marginTop: vs(4) }}>{strength.label}</Text>
            </View>
          )}
          <PremiumInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} icon={LockKeyhole} secureTextEntry returnKeyType="done" onSubmitEditing={handleSignUp} inputRef={confirmRef} error={confirmPassword.length > 0 && confirmPassword !== password} />
        </Animated.View>

        {/* anim[3]: terms checkbox + error */}
        <Animated.View style={[anim[3], { marginTop: vs(4) }]}>
          <Pressable
            onPress={toggleAgreed}
            style={{
              flexDirection: "row", alignItems: "flex-start", gap: s(14),
              backgroundColor: GLASS.card.backgroundColor,
              borderColor: agreed ? C.purpleL : GLASS.card.borderColor,
              borderWidth: 1, borderRadius: s(16), padding: s(16),
              marginBottom: vs(4),
            }}
          >
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <View style={{
                width: s(22), height: s(22), borderRadius: s(6), borderWidth: 1.5,
                borderColor: agreed ? C.purpleL : C.borderBright,
                backgroundColor: agreed ? C.purpleL : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {agreed && <Check size={s(13)} color={C.bgDeep} strokeWidth={2.5} />}
              </View>
            </Animated.View>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), flex: 1, lineHeight: vs(20) }}>
              I agree to the terms and conditions.
            </Text>
          </Pressable>
          {error && (
            <Text style={{ color: C.danger, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(8) }}>{error}</Text>
          )}
        </Animated.View>

        {/* anim[4]: CTA — follows content naturally */}
        <Animated.View style={[anim[4], { opacity: ctaOpacity, marginTop: vs(32) }]}>
          <GradientBtn onPress={handleSignUp} loading={loading} label="Create Account" />
          <Btn onPress={onSwitchToSignIn} style={{ alignItems: "center", marginTop: vs(18) }} pressScale={0.97}>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
              Have an account?{"  "}<Text style={{ color: C.purpleL, fontFamily: FONT.semiBold }}>Sign in</Text>
            </Text>
          </Btn>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── SkillsSection ─────────────────────────────────────────────────────────────

function SkillsSection({
  scrollRef,
  onStoreY,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  onStoreY: (y: number) => void;
}) {
  const { tokens: { C } } = useTheme();
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const { onLayout, active } = useSectionReveal(scrollRef, onStoreY);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loaded = useRef(false);
  const anim = useEntrance(4, 90, active);

  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const hasAny = selected.size > 0;
    Animated.timing(badgeOpacity, { toValue: hasAny ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(ctaOpacity, { toValue: hasAny ? 1 : 0.45, duration: 200, useNativeDriver: true }).start();
  }, [selected.size]);

  useEffect(() => {
    if (!active || loaded.current || !user) return;
    loaded.current = true;
    supabase.from("profiles").select("skills").eq("id", user.id).single().then(({ data }) => {
      if (!data?.skills?.length) return;
      const existing: string[] = data.skills;
      const presetSet = new Set(SKILL_CATEGORIES.flatMap(c => c.skills));
      setCustomSkills(existing.filter(sk => !presetSet.has(sk)));
      setSelected(new Set(existing));
    });
  }, [active, user?.id]);

  function toggleSkill(skill: string) {
    haptic.light();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  }

  function addCustomSkill() {
    const trimmed = customInput.trim();
    if (!trimmed || customSkills.includes(trimmed) || selected.has(trimmed)) return;
    haptic.light();
    setCustomSkills(prev => [...prev, trimmed]);
    setSelected(prev => new Set([...prev, trimmed]));
    setCustomInput("");
  }

  async function handleSubmit() {
    const allSkills = Array.from(selected);
    const storageKey = user ? `skills_set_${user.id}` : "skills_set";
    if (!user) {
      await AsyncStorage.setItem(storageKey, "true");
      router.replace("/(app)/(tabs)");
      return;
    }
    setLoading(true); haptic.medium();
    try {
      const { error } = await supabase.from("profiles").upsert(
        { id: user.id, skills: allSkills, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (error) throw error;
      haptic.success();
      await AsyncStorage.setItem(storageKey, "true");
      router.replace("/(app)/(tabs)");
    } catch {
      haptic.error();
      Alert.alert("Error", "Failed to save skills. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ minHeight: height }} onLayout={onLayout}>
      <Animated.View style={{
        paddingHorizontal: s(28),
        paddingTop: vs(32),
        paddingBottom: vs(60),
      }}>
        {/* anim[0]: StepProgressBar + header + floating badge */}
        <Animated.View style={anim[0]}>
          <StepProgressBar step={2} totalSteps={2} />
          <View style={{ marginTop: vs(24), marginBottom: vs(4) }}>
            <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(32), lineHeight: vs(40) }}>
              What do you bring?
            </Text>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(15), marginTop: vs(8), lineHeight: vs(22) }}>
              Select skills that represent you. Add your own too.
            </Text>
            <Animated.View pointerEvents="none" style={{
              position: "absolute", top: vs(24), right: 0,
              opacity: badgeOpacity, backgroundColor: C.purple,
              borderRadius: s(20), paddingHorizontal: s(12), paddingVertical: vs(4),
            }}>
              <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12) }}>{selected.size} selected</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* anim[1]: category chip grid */}
        <Animated.View style={anim[1]}>
          {SKILL_CATEGORIES.map(category => {
            const CatIcon = category.icon;
            return (
              <View key={category.title}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginTop: vs(24), marginBottom: vs(10) }}>
                  <CatIcon size={s(15)} color={C.purpleL} strokeWidth={2} />
                  <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12), letterSpacing: 0.8 }}>{category.title}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
                  {category.skills.map(skill => (
                    <SkillChip key={skill} label={skill} selected={selected.has(skill)} onPress={() => toggleSkill(skill)} />
                  ))}
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* anim[2]: "Add your own" + custom input chip */}
        <Animated.View style={anim[2]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginTop: vs(24), marginBottom: vs(10) }}>
            <Plus size={s(15)} color={C.purpleL} strokeWidth={2} />
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(12), letterSpacing: 0.8 }}>ADD YOUR OWN</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
            {customSkills.map(skill => (
              <SkillChip key={skill} label={skill} selected={selected.has(skill)} onPress={() => toggleSkill(skill)} />
            ))}
            <View style={{
              flexDirection: "row", alignItems: "center",
              borderWidth: 1, borderColor: `${C.borderBright}66`, borderRadius: s(20),
              paddingLeft: s(14), paddingRight: s(6), paddingVertical: vs(6),
              backgroundColor: "rgba(255,248,240,0.04)",
            }}>
              <TextInput
                value={customInput} onChangeText={setCustomInput} onSubmitEditing={addCustomSkill}
                placeholder="Add skill…" placeholderTextColor={C.textMuted} returnKeyType="done"
                style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(13), minWidth: s(80), maxWidth: s(150), paddingVertical: 0 }}
              />
              {customInput.trim().length > 0 && (
                <Btn onPress={addCustomSkill} pressScale={0.9} style={{ marginLeft: s(6) }}>
                  <View style={{ width: s(26), height: s(26), borderRadius: s(13), backgroundColor: C.purpleL, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.bgDeep, fontFamily: FONT.bold, fontSize: fs(14), lineHeight: fs(16) }}>+</Text>
                  </View>
                </Btn>
              )}
            </View>
          </View>
        </Animated.View>

        {/* anim[3]: CTA */}
        <Animated.View style={[anim[3], { opacity: ctaOpacity, marginTop: vs(40) }]}>
          <GradientBtn onPress={handleSubmit} loading={loading} label="Continue →" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── OnboardingFlow ────────────────────────────────────────────────────────────

type FlowChoice = "signin" | "signup" | null;

export default function OnboardingFlow() {
  const { tokens: { C } } = useTheme();
  const { height } = useWindowDimensions();

  const [choice, setChoice] = useState<FlowChoice>(null);
  const [showSkills, setShowSkills] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionYs = useRef<Partial<Record<"signin" | "signup" | "skills", number>>>({});
  const isSwitching = useRef(false);

  // ── Ambient breathing halo ──────────────────────────────────────────────────
  const breathAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const breathOpacity = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] });

  // ── Welcome parallax (native-driven, zero JS overhead) ─────────────────────
  const welcomeParallax = scrollY.interpolate({
    inputRange: [0, height],
    outputRange: [0, -vs(90)],
    extrapolate: "clamp",
  });

  // ── switchTo — smooth choice pivot ──────────────────────────────────────────
  async function switchTo(newChoice: FlowChoice) {
    if (isSwitching.current) return;
    haptic.medium();

    if (choice === newChoice) {
      const y = sectionYs.current[newChoice as "signin" | "signup"];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: y - vs(16), animated: true });
      return;
    }

    isSwitching.current = true;
    if (choice !== null) {
      // Scroll outgoing section off-screen before switching
      scrollRef.current?.scrollTo({ y: height - vs(32), animated: true });
      await new Promise<void>(r => setTimeout(r, 300));
    }
    setChoice(newChoice);
    isSwitching.current = false;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      {/* Ambient halo — rendered first so it sits behind everything */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "12%",
          alignSelf: "center",
          width: s(360),
          height: s(360),
          borderRadius: s(180),
          backgroundColor: C.purple,
          opacity: breathOpacity,
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          <WelcomeSection
            switchTo={switchTo}
            parallaxY={welcomeParallax}
          />

          {choice === "signin" && (
            <SignInSection
              scrollRef={scrollRef}
              onStoreY={y => { sectionYs.current.signin = y; }}
              onSwitchToSignUp={() => switchTo("signup")}
            />
          )}

          {choice === "signup" && (
            <SignUpSection
              scrollRef={scrollRef}
              onStoreY={y => { sectionYs.current.signup = y; }}
              onSuccess={() => setShowSkills(true)}
              onSwitchToSignIn={() => switchTo("signin")}
            />
          )}

          {showSkills && (
            <SkillsSection
              scrollRef={scrollRef}
              onStoreY={y => { sectionYs.current.skills = y; }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
