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
 * Font scale — respects the device's accessibility text-size setting.
 * Pass the design font size in pt; returns a scaled value.
 */
export function fs(size: number): number {
  const scaled = ms(size, 0.3);
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/** Screen width — use for percentage-based widths */
export const W = SCREEN_W;

/** Screen height */
export const H = SCREEN_H;

/** true when running on a narrow device (iPhone SE etc.) */
export const isSmallScreen = SCREEN_W < 380;

/** true when running on a wide device (Plus/Pro Max) */
export const isLargeScreen = SCREEN_W >= 420;
