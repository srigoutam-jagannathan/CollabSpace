import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

export function useEntrance(count: number, delayMs = 80, active = true) {
  const [opacities] = useState(() =>
    Array.from({ length: count }, () => new Animated.Value(0))
  );
  const [translates] = useState(() =>
    Array.from({ length: count }, () => new Animated.Value(16))
  );

  useEffect(() => {
    // When inactive: do nothing — content stays visible as panel slides away.
    // When active: reset to initial state then stagger in.
    if (!active) return;
    opacities.forEach(op => op.setValue(0));
    translates.forEach(t => t.setValue(16));
    Animated.stagger(
      delayMs,
      opacities.map((op, i) =>
        Animated.parallel([
          Animated.timing(op, { toValue: 1, duration: 560, useNativeDriver: true }),
          Animated.timing(translates[i], {
            toValue: 0,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, [active]);

  return opacities.map((op, i) => ({
    opacity: op,
    transform: [{ translateY: translates[i] }],
  }));
}
