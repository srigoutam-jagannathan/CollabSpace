/**
 * Btn — a Pressable wrapper that adds visual press feedback to every interactive
 * element in the app.  Opacity drops to 0.65 on press; scale subtly shrinks.
 *
 * Usage: drop-in replacement for Pressable anywhere you want feedback.
 *
 *   import { Btn } from "@/components/Btn";
 *   <Btn onPress={...} style={{ ... }}>...</Btn>
 */
import { Pressable, type PressableProps, type ViewStyle, type StyleProp, Animated } from "react-native";
import { useRef } from "react";

interface BtnProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Scale factor on press. Defaults to 0.96. Set to 1 to disable scale. */
  pressScale?: number;
}

export function Btn({ children, style, pressScale = 0.96, onPress, ...rest }: BtnProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: pressScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        style as ViewStyle,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
