import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { generateIdentity } from "@/utils/projectIdentity";

/**
 * The generated identity, painted.
 *
 * Four layers, bottom to top: a linear base gradient, an off-axis highlight
 * wash standing in for the spec's radial highlight (expo-linear-gradient has
 * no radial mode and a hard-edged circle looks worse than a soft diagonal),
 * a rotated stripe overlay, and a darkening veil so text stays legible over
 * whichever pair came out of the hash.
 */
export function GeneratedBackdrop({
  projectId,
  veil = "card",
}: {
  projectId: string;
  /** "card" is the deck's tall card; "tile" is the shallower rail tile. */
  veil?: "card" | "tile";
}) {
  const { base, highlight, highlightX, angle } = generateIdentity(projectId);

  const veilStops: readonly [string, string, string] =
    veil === "card"
      ? ["rgba(18,9,8,0.12)", "rgba(18,9,8,0.70)", "rgba(18,9,8,0.96)"]
      : ["rgba(18,9,8,0.10)", "rgba(18,9,8,0.55)", "rgba(18,9,8,0.86)"];

  return (
    <View style={{ ...StyleSheetAbsolute, overflow: "hidden" }} pointerEvents="none">
      <LinearGradient
        colors={base}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheetAbsolute}
      />

      <LinearGradient
        colors={[`${highlight}99`, "transparent"]}
        start={{ x: highlightX, y: 0 }}
        end={{ x: highlightX + 0.45, y: 0.75 }}
        style={StyleSheetAbsolute}
      />

      {/* Rotated far larger than the box so the bars run edge to edge at any
          angle rather than leaving bare corners. */}
      <View
        style={{
          position: "absolute",
          top: "-75%", left: "-75%", right: "-75%", bottom: "-75%",
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        {Array.from({ length: 26 }, (_, i) => (
          <View
            key={i}
            style={{
              height: 12,
              marginBottom: 14,
              backgroundColor: "rgba(255,248,240,0.05)",
            }}
          />
        ))}
      </View>

      <LinearGradient
        colors={veilStops}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheetAbsolute}
      />
    </View>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0, left: 0, right: 0, bottom: 0,
};
