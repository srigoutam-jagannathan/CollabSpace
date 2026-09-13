import { AccessibilityInfo } from "react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useReducedMotion } from "./useReducedMotion";

describe("useReducedMotion", () => {
  const remove = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove } as any);
  });

  test("reports the setting once it resolves", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  test("stays permissive when the read rejects", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  test("unsubscribes on unmount", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    const { unmount } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(AccessibilityInfo.addEventListener).toHaveBeenCalled());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
