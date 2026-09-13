/**
 * Responsive scaling utilities for CollabSpace.
 *
 * Base dimensions = iPhone 14 / 15 (390 × 844 pt) — the design target.
 * All Figma values should be passed through these helpers before use.
 *
 * Usage:
 *   import { s, vs, ms, fs } from "@/utils/scale";
 *
 *   style={{ padding: s(16), marginTop: vs(24), fontSize: fs(16) }}
 */

import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const BASE_W = 390; // iPhone 14/15 logical width (pt)
const BASE_H = 844; // iPhone 14/15 logical height (pt)

/** Horizontal scale — use for widths, horizontal padding/margin */
export function s(size: number): number {
  return (SCREEN_W / BASE_W) * size;
}

/** Vertical scale — use for heights, vertical padding/margin */
export function vs(size: number): number {
  return (SCREEN_H / BASE_H) * size;
}

/**
 * Moderate scale — smoothed between fixed and full-scale.
 * factor 0 = no scaling (fixed), factor 1 = full s() scale.
 * Default factor 0.5 is a good balance for most values.
 */
export function ms(size: number, factor = 0.5): number {
  return size + (s(size) - size) * factor;
}

/**
 * Font scale — maps a design font size onto the current screen width.
 *
 * This does NOT apply the user's accessibility text-size setting, and must
 * not: React Native's <Text> has allowFontScaling on by default and nothing
 * in this app overrides it, so Dynamic Type is already applied downstream.
 * Multiplying by PixelRatio.getFontScale() here would apply it twice.
 *
 * What that leaves is the layout problem — see ts().
 */
export function fs(size: number): number {
  const scaled = ms(size, 0.3);
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Text-aware container scale — for a width or height that has to grow when
 * the user's text does.
 *
 * Text scales itself; the boxes around it do not, so a fixed-width rail card
 * at 200% text truncates every label inside it. Sizing those containers with
 * ts() instead of s() lets them grow in step, which is the "rails grow taller
 * rather than truncating" clause of the design spec.
 *
 * Clamped to 2x, matching the 200% ceiling that clause names. Use s() for
 * anything that should stay put regardless of text size — gutters, hairlines,
 * icon boxes, corner radii.
 */
export function ts(size: number): number {
  const fontScale = Math.min(Math.max(PixelRatio.getFontScale(), 1), 2);
  return s(size) * fontScale;
}

/** Screen width — use for percentage-based widths */
export const W = SCREEN_W;

/** Screen height */
export const H = SCREEN_H;

/** true when running on a narrow device (iPhone SE etc.) */
export const isSmallScreen = SCREEN_W < 380;

/** true when running on a wide device (Plus/Pro Max) */
export const isLargeScreen = SCREEN_W >= 420;
