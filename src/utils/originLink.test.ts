jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);

import { act, renderHook } from "@testing-library/react-native";
import { useBackToOrigin, useOpenProfile, useOpenProjectPreview } from "./originLink";
import { mockRouter, routerState } from "@/test/routerMock";

beforeEach(() => routerState.reset());

test("opening a profile stamps the current pathname as its origin", () => {
  routerState.setPathname("/chat/dm/c1");
  const { result } = renderHook(() => useOpenProfile());
  act(() => result.current("u9"));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/(app)/users/[id]",
    params: { id: "u9", from: "/chat/dm/c1" },
  });
});

test("opening a project preview stamps the current pathname as its origin", () => {
  routerState.setPathname("/search");
  const { result } = renderHook(() => useOpenProjectPreview());
  act(() => result.current("p1"));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/(app)/projects/[id]/preview",
    params: { id: "p1", from: "/search" },
  });
});

test("back pops the stack when it can, even with an origin", () => {
  const { result } = renderHook(() => useBackToOrigin("/search"));
  act(() => result.current());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

test("back with no history goes to the origin", () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const { result } = renderHook(() => useBackToOrigin("/search"));
  act(() => result.current());
  expect(mockRouter.navigate).toHaveBeenCalledWith("/search");
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test("back without an origin falls back to an ordinary back", () => {
  const { result } = renderHook(() => useBackToOrigin(undefined));
  act(() => result.current());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test("back with no origin and no history goes to Discover", () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const { result } = renderHook(() => useBackToOrigin(undefined));
  act(() => result.current());
  expect(mockRouter.navigate).toHaveBeenCalledWith("/(app)");
});

test("a screen can choose its own fallback", () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const { result } = renderHook(() => useBackToOrigin(undefined, "/(app)/projects"));
  act(() => result.current());
  expect(mockRouter.navigate).toHaveBeenCalledWith("/(app)/projects");
});
