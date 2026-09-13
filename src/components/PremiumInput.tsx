import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

type IconComponent = React.ComponentType<{
  size: number;
  color: string;
  strokeWidth: number;
}>;

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: IconComponent;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  error?: boolean;
  autoComplete?: string;
};

export function PremiumInput({
  label,
  value,
  onChangeText,
  icon: Icon,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  returnKeyType = "next",
  onSubmitEditing,
  inputRef,
  error = false,
  autoComplete,
}: Props) {
  const { tokens: { C } } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const active = focused || value.length > 0;

  // Floating label animation
  const labelY = useRef(new Animated.Value(active ? vs(-10) : vs(18))).current;
  const labelScale = useRef(new Animated.Value(active ? 0.73 : 1)).current;
  // Border + glow animation (useNativeDriver:false because we animate colors/shadows)
  const focusAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  function animateActive(toActive: boolean) {
    Animated.parallel([
      Animated.timing(labelY, {
        toValue: toActive ? vs(-10) : vs(18),
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(labelScale, {
        toValue: toActive ? 0.73 : 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function animateFocus(toFocused: boolean) {
    Animated.timing(focusAnim, {
      toValue: toFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }

  function handleFocus() {
    setFocused(true);
    animateActive(true);
    animateFocus(true);
  }

  function handleBlur() {
    setFocused(false);
    if (value.length === 0) animateActive(false);
    animateFocus(false);
  }

  const borderColor = error
    ? C.danger
    : focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [C.borderSubtle, C.purpleL],
      });

  const shadowOpacity = error
    ? 0
    : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] });

  const labelColor = error
    ? C.danger
    : active
    ? C.purpleL
    : C.textMuted;

  return (
    <View style={{ position: "relative", marginBottom: vs(10) }}>
      {/* Floating label */}
      <Animated.Text
        pointerEvents="none"
        style={{
          position: "absolute",
          left: s(48),
          fontFamily: FONT.semiBold,
          color: labelColor,
          zIndex: 2,
          transform: [
            { translateY: labelY },
            { scale: labelScale },
          ],
          // anchor scaling from left so it doesn't jump right
          transformOrigin: "left center" as any,
        }}
      >
        {label}
      </Animated.Text>

      {/* Input row */}
      <Animated.View
        style={{
          height: vs(58),
          borderRadius: s(16),
          borderWidth: 1,
          borderColor,
          backgroundColor: "rgba(255,248,240,0.05)",
          flexDirection: "row",
          alignItems: "center",
          shadowColor: C.purpleL,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity,
          shadowRadius: s(8),
          elevation: 0,
        }}
      >
        {/* Leading icon */}
        <View style={{ paddingLeft: s(16), paddingRight: s(4) }}>
          <Icon
            size={s(18)}
            color={error ? C.danger : C.purpleL}
            strokeWidth={1.8}
          />
        </View>

        {/* Text field */}
        <TextInput
          ref={inputRef as React.RefObject<TextInput>}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !showSecret}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoComplete={autoComplete as any}
          style={{
            flex: 1,
            paddingTop: vs(16),
            paddingLeft: s(6),
            paddingRight: s(4),
            color: C.white,
            fontFamily: FONT.regular,
            fontSize: fs(15),
          }}
          placeholderTextColor="transparent"
        />

        {/* Eye toggle */}
        {secureTextEntry && (
          <Pressable
            onPress={() => setShowSecret((v) => !v)}
            hitSlop={10}
            style={{ paddingRight: s(16) }}
          >
            {showSecret ? (
              <EyeOff size={s(18)} color={C.textMuted} strokeWidth={1.8} />
            ) : (
              <Eye size={s(18)} color={C.textMuted} strokeWidth={1.8} />
            )}
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
