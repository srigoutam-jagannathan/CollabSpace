/**
 * CollabSpace — "Warm Espresso / Warm Cream" dual design system
 *
 * Palette (shared by both themes):
 *   #fff8f0  Warm cream     — bg in light, text/highlight in dark
 *   #c08552  Caramel brown  — primary accent (CTAs, active states)
 *   #8c5a3c  Deep tan       — secondary accent, gradient end
 *   #4b2e2b  Espresso brown — bg in dark, text in light
 *
 * Token names are stable — components import { FONT } statically and
 * destructure { C, GLASS, GRADIENT } from useTheme() at runtime.
 * The backward-compat static C/GLASS/GRADIENT exports point at the
 * dark theme so any unmigrated file still compiles correctly.
 */

// ── Shared types ──────────────────────────────────────────────────────────────

export type CTokens = {
  bgDeep: string; bgMid: string; bgBottom: string;
  surface: string; surfaceBright: string;
  border: string; borderBright: string;
  purple: string; purpleL: string;
  pink: string; pinkD: string;
  yellow: string; yellowD: string;
  white: string; textMuted: string; textFaint: string;
  danger: string; success: string;
  // Semantic surface tokens (used in place of hardcoded hex values)
  inputBg: string;
  chatBubbleOther: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabBarBg: string;
  fieldBg: string;
  switchTrackOff: string;
  modalBg: string;
  filterPanelBg: string;
  avatarBg: string;
  borderSubtle: string;
};

export type GlassTokens = {
  card:         { backgroundColor: string; borderColor: string; borderWidth: number };
  chip:         { backgroundColor: string; borderColor: string; borderWidth: number };
  chipSelected: { backgroundColor: string; borderColor: string; borderWidth: number };
};

export type GradientTokens = {
  bg:      readonly [string, string];
  card:    readonly [string, string];
  cta:     readonly [string, string, string];
  ctaSoft: readonly [string, string, string];
};

export type ThemeTokens = {
  C: CTokens;
  GLASS: GlassTokens;
  GRADIENT: GradientTokens;
};

// ── Dark theme — "Warm Espresso" ──────────────────────────────────────────────

export const DARK_THEME: ThemeTokens = {
  GRADIENT: {
    bg:      ["#1a0e0c", "#1a0e0c"],
    card:    ["rgba(75,46,43,0.42)", "rgba(27,14,13,0.62)"],
    cta:     ["#c08552", "#a06840", "#8c5a3c"],
    ctaSoft: ["#a06840", "#8c5a3c", "#6e4530"],
  },
  C: {
    bgDeep:   "#120908",
    bgMid:    "#1f1210",
    bgBottom: "#1a0e0c",

    surface:       "rgba(75,46,43,0.68)",
    surfaceBright: "rgba(140,90,60,0.52)",

    border:       "rgba(192,133,82,0.22)",
    borderBright: "rgba(192,133,82,0.40)",

    purple:  "#c08552",
    purpleL: "#d4a06a",

    pink:    "#c08552",
    pinkD:   "#a06840",

    yellow:  "#fff8f0",
    yellowD: "#f0dcc0",

    white:      "#fff8f0",
    textMuted:  "rgba(255,248,240,0.50)",
    textFaint:  "rgba(255,248,240,0.26)",

    danger:  "#F87171",
    success: "#34D399",

    inputBg:         "#1f1210",
    chatBubbleOther: "#1f1210",
    tabActiveBg:     "#fff8f0",
    tabActiveText:   "#4b2e2b",
    tabBarBg:        "rgba(26,14,12,0.92)",
    fieldBg:         "rgba(255,255,255,0.06)",
    switchTrackOff:  "rgba(255,248,240,0.12)",
    modalBg:         "#1a0e0c",
    filterPanelBg:   "rgba(26,14,12,0.88)",
    avatarBg:        "#2e1815",
    borderSubtle:    "#2e1815",
  },
  GLASS: {
    card: {
      backgroundColor: "rgba(75,46,43,0.08)",
      borderColor:     "rgba(192,133,82,0.15)",
      borderWidth: 1,
    },
    chip: {
      backgroundColor: "rgba(75,46,43,0.10)",
      borderColor:     "rgba(192,133,82,0.20)",
      borderWidth: 1,
    },
    chipSelected: {
      backgroundColor: "rgba(192,133,82,0.24)",
      borderColor:     "rgba(212,160,106,0.55)",
      borderWidth: 1.5,
    },
  },
};

// ── Light theme — "Warm Cream" ────────────────────────────────────────────────

export const LIGHT_THEME: ThemeTokens = {
  GRADIENT: {
    bg:      ["#faf0e4", "#faf0e4"],
    card:    ["rgba(192,133,82,0.12)", "rgba(140,90,60,0.08)"],
    cta:     ["#c08552", "#a06840", "#8c5a3c"],
    ctaSoft: ["#a06840", "#8c5a3c", "#6e4530"],
  },
  C: {
    bgDeep:   "#ecdcc8",
    bgMid:    "#f5e8d8",
    bgBottom: "#faf0e4",

    surface:       "rgba(255,255,255,0.55)",
    surfaceBright: "rgba(255,255,255,0.75)",

    border:       "rgba(192,133,82,0.30)",
    borderBright: "rgba(192,133,82,0.55)",

    purple:  "#8c5a3c",
    purpleL: "#a06840",

    pink:    "#8c5a3c",
    pinkD:   "#6e4530",

    yellow:  "#c08552",
    yellowD: "#a06840",

    white:      "#4b2e2b",
    textMuted:  "rgba(75,46,43,0.55)",
    textFaint:  "rgba(75,46,43,0.32)",

    danger:  "#c0392b",
    success: "#1a7a50",

    inputBg:         "rgba(255,255,255,0.50)",
    chatBubbleOther: "rgba(255,255,255,0.60)",
    tabActiveBg:     "#4b2e2b",
    tabActiveText:   "#fff8f0",
    tabBarBg:        "rgba(250,240,228,0.94)",
    fieldBg:         "rgba(255,255,255,0.55)",
    switchTrackOff:  "rgba(140,90,60,0.18)",
    modalBg:         "#faf0e4",
    filterPanelBg:   "rgba(250,240,228,0.97)",
    avatarBg:        "rgba(255,255,255,0.55)",
    borderSubtle:    "rgba(192,133,82,0.22)",
  },
  GLASS: {
    card: {
      backgroundColor: "rgba(255,255,255,0.60)",
      borderColor:     "rgba(192,133,82,0.32)",
      borderWidth: 1,
    },
    chip: {
      backgroundColor: "rgba(255,255,255,0.50)",
      borderColor:     "rgba(192,133,82,0.38)",
      borderWidth: 1,
    },
    chipSelected: {
      backgroundColor: "rgba(192,133,82,0.25)",
      borderColor:     "rgba(192,133,82,0.60)",
      borderWidth: 1.5,
    },
  },
};

// ── Backward-compat static exports (point at dark theme) ─────────────────────
// Any file that hasn't migrated to useTheme() still works identically.

export const GRADIENT = DARK_THEME.GRADIENT;
export const C        = DARK_THEME.C;
export const GLASS    = DARK_THEME.GLASS;

// ── Typography — static, never themed ────────────────────────────────────────

export const FONT = {
  regular:   "Lato_400Regular",
  medium:    "Lato_400Regular",
  semiBold:  "Lato_700Bold",
  bold:      "Lato_700Bold",
  extraBold: "Lato_900Black",
} as const;
