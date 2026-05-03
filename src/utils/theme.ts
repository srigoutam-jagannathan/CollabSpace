/**
 * CollabSpace — "Midnight Bloom" design system
 *
 * Palette: purple · pink · yellow · white · black
 * Background: near-void black → deep violet → rich purple-magenta bloom
 */

// ── Background gradient ────────────────────────────────────────────────────────
export const GRADIENT = {
  /** Full-screen background — handled by GradientBg SVG component */
  bg: ["#0F0230", "#0F0230"] as const,
  /** Subtle surface card gradient */
  card: ["rgba(60,12,110,0.40)", "rgba(20,4,58,0.60)"] as const,
  /**
   * CTA button — purple → mid-violet → soft dusty-pink.
   * Three stops for a smooth, diffuse transition; no harsh neon end.
   */
  cta: ["#5E1EC8", "#8C28B4", "#B0309A"] as const,
  /** Softer / secondary CTA */
  ctaSoft: ["#4A18A8", "#7020A0", "#942890"] as const,
} as const;

// ── Static colours ─────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds
  bgDeep:   "#0A0120",
  bgMid:    "#160340",
  bgBottom: "#0F0230",

  // Surfaces — semi-transparent so the radial bg bleeds through
  surface:       "rgba(30, 8, 72, 0.68)",
  surfaceBright: "rgba(50, 12, 100, 0.55)",

  // Borders
  border:       "rgba(120, 60, 220, 0.22)",
  borderBright: "rgba(180, 50, 160, 0.35)",

  // Accent purple — slightly muted, less neon
  purple:  "#6824CC",
  purpleL: "#9434D8",

  // Accent pink — dusty/warm, not harsh magenta
  pink:    "#C036A0",
  pinkD:   "#A02888",

  // Pink card colour (replaces yellow)
  yellow:  "#FFD1E3",
  yellowD: "#FFB3CC",

  // Text
  white:      "#FFFFFF",
  textMuted:  "rgba(255,255,255,0.50)",
  textFaint:  "rgba(255,255,255,0.26)",

  // Semantic
  danger:  "#F87171",
  success: "#34D399",
} as const;

// ── Glass tile system ──────────────────────────────────────────────────────────
export const GLASS = {
  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor:     "rgba(255,255,255,0.14)",
    borderWidth: 1,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor:     "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: "rgba(180,100,255,0.22)",
    borderColor:     "rgba(210,160,255,0.50)",
    borderWidth: 1.5,
  },
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────
// Lato weights: 400 Regular, 700 Bold, 900 Black (no 500/600 — medium collapses to regular intentionally)
export const FONT = {
  regular:   "Lato_400Regular",
  medium:    "Lato_400Regular",
  semiBold:  "Lato_700Bold",
  bold:      "Lato_700Bold",
  extraBold: "Lato_900Black",
} as const;
