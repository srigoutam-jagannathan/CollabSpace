import { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { s, vs, ts } from "@/utils/scale";

/** Which section's shape to imitate while its first load is in flight. */
export type SkeletonShape = "hero" | "rail" | "people";

function Block({ w, h, r, o }: { w: number | string; h: number; r?: number; o: Animated.Value | number }) {
  const { tokens: { C } } = useTheme();
  return (
    <Animated.View
      style={{
        width: w as any, height: h, borderRadius: r ?? s(6),
        backgroundColor: C.switchTrackOff, opacity: o,
      }}
    />
  );
}

/**
 * Placeholders shaped like the section they stand in for, rather than a
 * spinner. The point is that the first paint already has the height and rhythm
 * of the loaded screen, so nothing jumps when the data lands — a catalogue
 * that is genuinely thin should still feel composed on arrival.
 */
export function SectionSkeleton({ shape }: { shape: SkeletonShape }) {
  const { tokens: { C, GLASS } } = useTheme();
  const reducedMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 720, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, pulse]);

  const card = {
    backgroundColor: GLASS.card.backgroundColor,
    borderWidth: 1,
    borderColor: GLASS.card.borderColor,
  };

  if (shape === "hero") {
    return (
      <View style={{ paddingHorizontal: s(20) }}>
        {[0, 1].map(i => (
          <View key={i} style={{ ...card, borderRadius: s(17), padding: s(13), marginBottom: vs(9), gap: vs(7) }}>
            <Block w={s(104)} h={vs(15)} r={s(7)} o={pulse} />
            <Block w={"58%"} h={vs(13)} o={pulse} />
            <Block w={"100%"} h={vs(10)} o={pulse} />
            <Block w={"82%"} h={vs(10)} o={pulse} />
            <Block w={s(120)} h={vs(8)} o={pulse} />
            <Block w={"100%"} h={44} r={s(10)} o={pulse} />
          </View>
        ))}
      </View>
    );
  }

  // Must track the real cards in ActiveNow / PeopleToKnow, or the
  // layout shifts sideways the moment data lands.
  const width = shape === "rail" ? ts(118) : ts(96);
  return (
    <View style={{ flexDirection: "row", gap: s(8), paddingHorizontal: s(20) }}>
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            ...card, width, borderRadius: s(13), padding: s(10), gap: vs(6),
            alignItems: shape === "people" ? "center" : "stretch",
          }}
        >
          {shape === "people" && <Block w={s(38)} h={s(38)} r={s(19)} o={pulse} />}
          <Block w={shape === "people" ? s(52) : "72%"} h={vs(11)} o={pulse} />
          <Block w={shape === "people" ? s(38) : "94%"} h={vs(9)} o={pulse} />
        </View>
      ))}
    </View>
  );
}
