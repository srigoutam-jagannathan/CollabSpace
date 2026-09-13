import { useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect } from "react-native-svg";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Full-screen radial gradient background.
 * Two soft glow spots on opposite diagonals:
 *   • Top-left  → Warm Espresso (dark) / Warm Cream (light) warm glow
 *   • Bottom-right → Warm Espresso (dark) / Warm Cream (light) warm glow
 * Rendered with SVG so it stays behind all navigation layers.
 */
export function GradientBg() {
  const { width, height } = useWindowDimensions();
  const { mode } = useTheme();
  const isLight = mode === "light";

  const baseFill = isLight ? "#faf0e4" : "#1a0e0c";
  const glowStops = isLight
    ? [
        { offset: "0%",   color: "#c08552", opacity: "0.32" },
        { offset: "25%",  color: "#a06840", opacity: "0.16" },
        { offset: "55%",  color: "#c08552", opacity: "0.07" },
        { offset: "100%", color: "#faf0e4", opacity: "0"    },
      ]
    : [
        { offset: "0%",   color: "#c08552", opacity: "0.42" },
        { offset: "25%",  color: "#a06840", opacity: "0.28" },
        { offset: "55%",  color: "#6e3e24", opacity: "0.12" },
        { offset: "100%", color: "#1a0e0c", opacity: "0"    },
      ];

  // Large, diffuse ellipses — colour spread wide, not concentrated at centre
  const rx = width * 0.58;
  const ry = height * 0.30;

  // Diagonal centres
  const tlX = width * 0.15;
  const tlY = height * 0.14;
  const brX = width * 0.85;
  const brY = height * 0.86;

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        {/* Diffuse warm glow — four stops, low peak opacity, long fade */}
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          {glowStops.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </RadialGradient>
      </Defs>

      {/* Base fill — espresso dark or cream light */}
      <Rect width={width} height={height} fill={baseFill} />

      {/* Top-left pink radial */}
      <Ellipse cx={tlX} cy={tlY} rx={rx} ry={ry} fill="url(#glow)" />

      {/* Bottom-right pink radial */}
      <Ellipse cx={brX} cy={brY} rx={rx} ry={ry} fill="url(#glow)" />
    </Svg>
  );
}
