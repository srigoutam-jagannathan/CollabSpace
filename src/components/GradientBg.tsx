import { useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect } from "react-native-svg";

/**
 * Full-screen radial gradient background.
 * Two soft glow spots on opposite diagonals:
 *   • Top-left  → violet / purple
 *   • Bottom-right → magenta / pink
 * Rendered with SVG so it stays behind all navigation layers.
 */
export function GradientBg() {
  const { width, height } = useWindowDimensions();

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
        {/* Diffuse dusty-pink glow — four stops, low peak opacity, long fade */}
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <Stop offset="0%"   stopColor="#C036A0" stopOpacity="0.42" />
          <Stop offset="25%"  stopColor="#A82890" stopOpacity="0.28" />
          <Stop offset="55%"  stopColor="#801870" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#0F0230" stopOpacity="0"    />
        </RadialGradient>
      </Defs>

      {/* Deep purple base */}
      <Rect width={width} height={height} fill="#0F0230" />

      {/* Top-left pink radial */}
      <Ellipse cx={tlX} cy={tlY} rx={rx} ry={ry} fill="url(#glow)" />

      {/* Bottom-right pink radial */}
      <Ellipse cx={brX} cy={brY} rx={rx} ry={ry} fill="url(#glow)" />
    </Svg>
  );
}
