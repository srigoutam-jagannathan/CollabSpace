import { useState } from "react";
import { View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { generateIdentity } from "@/utils/projectIdentity";

const FILL = {
  position: "absolute" as const,
  top: 0, left: 0, right: 0, bottom: 0,
};

/**
 * Whatever sits behind a project card.
 *
 * A real cover image when the project has one, and the deterministic
 * generated identity when it does not — which is still most of them, since
 * uploading artwork is optional and the archive has to look composed either
 * way. A cover that fails to load falls back to the generated art rather than
 * leaving a hole, so a broken URL degrades instead of breaking the card.
 *
 * The generated path draws four layers: a linear base gradient, an off-axis
 * highlight wash standing in for the spec's radial highlight (expo-linear-
 * gradient has no radial mode, and a hard-edged circle looked worse than a
 * soft diagonal), a rotated stripe overlay, and a darkening veil. The cover
 * path keeps only the veil, so text stays legible over an arbitrary image.
 */
export function ProjectBackdrop({
  projectId,
  coverUrl = null,
  veil = "card",
}: {
  projectId: string;
  /** Full public URL. Null or a failed load falls through to generated art. */
  coverUrl?: string | null;
  /** "card" is the deck's tall card; "tile" is the shallower rail tile. */
  veil?: "card" | "tile";
}) {
  const [failed, setFailed] = useState(false);
  const { base, highlight, highlightX, angle } = generateIdentity(projectId);

  const veilStops: readonly [string, string, string] =
    veil === "card"
      ? ["rgba(18,9,8,0.12)", "rgba(18,9,8,0.70)", "rgba(18,9,8,0.96)"]
      : ["rgba(18,9,8,0.10)", "rgba(18,9,8,0.55)", "rgba(18,9,8,0.86)"];

  const showCover = !!coverUrl && !failed;

  return (
    <View style={{ ...FILL, overflow: "hidden" }} pointerEvents="none">
      {showCover ? (
        <Image
          testID="project-cover"
          source={{ uri: coverUrl! }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={FILL}
        />
      ) : (
        <View testID="project-generated" style={FILL}>
          <LinearGradient
            colors={base}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={FILL}
          />
          <LinearGradient
            colors={[`${highlight}99`, "transparent"]}
            start={{ x: highlightX, y: 0 }}
            end={{ x: highlightX + 0.45, y: 0.75 }}
            style={FILL}
          />
          {/* Rotated far larger than the box so bars run edge to edge at any
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
                style={{ height: 12, marginBottom: 14, backgroundColor: "rgba(255,248,240,0.05)" }}
              />
            ))}
          </View>
        </View>
      )}

      <LinearGradient
        colors={veilStops}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={FILL}
      />
    </View>
  );
}
