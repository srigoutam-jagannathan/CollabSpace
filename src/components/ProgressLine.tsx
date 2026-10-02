import { useEffect, useState } from "react";
import { Animated, View, Easing } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * A 2pt indeterminate bar for background refetches — the case where content is
 * already on screen and replacing it with a spinner would be a regression.
 * Purely decorative: the screen it sits under announces its own state, so this
 * is hidden from screen readers rather than narrating a second time.
 */
export function ProgressLine({ visible }: { visible: boolean }) {
  const { tokens: { C } } = useTheme();
  const reducedMotion = useReducedMotion();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible || reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      slide.setValue(0);
    };
  }, [visible, reducedMotion, slide]);

  if (!visible) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 2, overflow: "hidden", backgroundColor: C.border }}
    >
      {reducedMotion ? (
        // No travelling segment — a steady bar still reads as "working".
        <View style={{ flex: 1, backgroundColor: C.purpleL, opacity: 0.5 }} />
      ) : (
        <Animated.View
          style={{
            height: 2,
            width: "35%",
            backgroundColor: C.purpleL,
            transform: [{
              translateX: slide.interpolate({
                inputRange: [0, 1],
                // Percentages are of the segment's own width, so -100% parks it
                // just off the left edge and 286% clears the right.
                outputRange: ["-100%", "286%"],
              }),
            }],
          }}
        />
      )}
    </View>
  );
}
