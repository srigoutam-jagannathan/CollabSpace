/**
 * Stand-in for expo-router, for tests.
 *
 *   jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
 *   import { mockRouter, routerState } from "@/test/routerMock";
 *   beforeEach(() => routerState.reset());
 *
 * One router object backs both useRouter() and the imperative `router`
 * export, the way it does in the real library.
 */
import { useEffect, type ReactNode } from "react";

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  dismissAll: jest.fn(),
  setParams: jest.fn(),
};

let pathname = "/";
let params: Record<string, string> = {};

export const routerState = {
  setPathname(next: string) {
    pathname = next;
  },
  setParams(next: Record<string, string>) {
    params = next;
  },
  reset() {
    pathname = "/";
    params = {};
    for (const fn of Object.values(mockRouter)) fn.mockReset();
    mockRouter.canGoBack.mockImplementation(() => true);
  },
};

export const expoRouterModule = {
  useRouter: () => mockRouter,
  router: mockRouter,
  usePathname: () => pathname,
  useLocalSearchParams: () => params,
  useGlobalSearchParams: () => params,
  // Behaves as if the screen gained focus once, on mount.
  useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  Redirect: () => null,
  Link: ({ children }: { children: ReactNode }) => children,
};
