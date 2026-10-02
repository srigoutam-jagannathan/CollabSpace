import { useEffect, useState } from "react";
import { View, Animated, useWindowDimensions } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { vs } from "@/utils/scale";

type Props = {
  step: number;
  totalSteps?: number;
};

export function StepProgressBar({ step, totalSteps = 2 }: Props) {
  const { tokens: { C } } = useTheme();
  const { width } = useWindowDimensions();
  const [fillAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: (step / totalSteps) * width,
      speed: 14,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  }, [step, totalSteps, width, fillAnim]);

  return (
    <View
      style={{
        width: "100%",
        height: vs(3),
        backgroundColor: C.borderSubtle,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          width: fillAnim,
          backgroundColor: C.purpleL,
        }}
      />
    </View>
  );
}
