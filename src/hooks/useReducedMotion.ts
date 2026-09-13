import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the device has "Reduce Motion" switched on.
 *
 * Reads the current value on mount and then tracks changes, since the user
 * can toggle the setting from Control Centre without leaving the app.
 * Defaults to false so a failed read degrades to full motion rather than
 * permanently flattening the UI.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (alive) setReduced(value); })
      .catch(() => { /* keep the permissive default */ });

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
