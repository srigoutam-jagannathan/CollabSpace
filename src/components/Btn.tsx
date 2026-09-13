/**
 * Btn — a Pressable that adds visual press feedback to every interactive
 * element in the app. Opacity drops on press; scale subtly shrinks.
 *
 * The style you pass lands on the pressable itself and the children are its
 * direct descendants, so layout styles (flexDirection, gap, justifyContent)
 * behave exactly as they would on a View.
 */
import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
  type GestureResponderEvent,
  type AccessibilityRole,
} from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BtnProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Scale factor on press. Defaults to 0.96. Set to 1 to disable scale. */
  pressScale?: number;
  /**
   * Minimum ms between accepted presses. Prevents double-tap from pushing the
   * same screen twice. Defaults to 500. Pass 0 to disable (e.g. steppers).
   */
  debounceMs?: number;
}

export function Btn({
  children,
  style,
  pressScale = 0.96,
  onPress,
  debounceMs = 500,
  accessibilityRole = "button" as AccessibilityRole,
  disabled,
  ...rest
}: BtnProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastPressAt = useRef(0);
  const [pressed, setPressed] = useState(false);
  // With Reduce Motion on, the press still gives feedback through opacity —
  // only the scale spring is dropped. Opacity is a fade, not motion, so it
  // stays: removing it too would leave presses with no feedback at all.
  const reducedMotion = useReducedMotion();

  function handlePress(e: GestureResponderEvent) {
    if (debounceMs > 0) {
      const now = Date.now();
      if (now - lastPressAt.current < debounceMs) return;
      lastPressAt.current = now;
    }
    onPress?.(e);
  }

  function handlePressIn() {
    setPressed(true);
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: pressScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    setPressed(false);
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled }}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        style,
        {
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
