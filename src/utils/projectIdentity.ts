/**
 * A completed project's visual identity, derived from its id alone.
 *
 * Projects have no cover image field and nobody is going to upload one, so the
 * archive generates a look instead. It must be pure and deterministic: the
 * same project has to look identical on every device and in every session, or
 * the archive stops feeling like a catalogue of real things.
 *
 * Every colour is an existing palette token, so the archive stays inside the
 * design system rather than inventing a second one.
 */

/** Light-to-dark pairs, all drawn from the coffee palette. */
const PAIRS = [
  ["#c08552", "#4b2e2b"],
  ["#8c5a3c", "#1a0e0c"],
  ["#d4a06a", "#4b2e2b"],
  ["#c08552", "#1a0e0c"],
  ["#d4a06a", "#6e4530"],
  ["#8c5a3c", "#4b2e2b"],
] as const;

/** Stripe angles, in degrees. */
const ANGLES = [38, 60, 82, 104, 126] as const;

/** Horizontal position of the radial highlight, as a fraction of the width. */
const HIGHLIGHTS = [0.2, 0.35, 0.5, 0.65, 0.8] as const;

export interface Identity {
  /** Base linear gradient, light end first. */
  base: readonly [string, string];
  /** Radial highlight colour — the light end of the pair. */
  highlight: string;
  /** Where the highlight sits horizontally, 0 (left) to 1 (right). */
  highlightX: number;
  /** Stripe overlay angle in degrees. */
  angle: number;
}

/**
 * FNV-1a, 32-bit. Chosen over anything cryptographic because this needs to be
 * cheap, stable across JS engines, and well spread over short ASCII strings —
 * which is exactly what a UUID is.
 *
 * `>>> 0` after each step keeps the value an unsigned 32-bit integer;
 * JavaScript's bitwise operators otherwise produce a signed result and the
 * modulo below would go negative.
 */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function generateIdentity(projectId: string): Identity {
  const hash = hashId(projectId);
  const pair = PAIRS[hash % PAIRS.length];

  return {
    base: pair,
    highlight: pair[0],
    // Different shifts of the same hash, so the three choices vary
    // independently rather than moving together in lockstep.
    highlightX: HIGHLIGHTS[(hash >>> 16) % HIGHLIGHTS.length],
    angle: ANGLES[(hash >>> 8) % ANGLES.length],
  };
}
