/**
 * originLink — navigation to and from the href:null tab screens.
 *
 * users/[id], projects/* , notifications and settings are registered in
 * app/(app)/_layout.tsx as href:null Tabs.Screen entries, not as screens
 * inside the stack that opens them. Reaching one is therefore a tab switch,
 * and that has two consequences:
 *
 *   - There is nothing beneath it for router.back() to pop. React Navigation's
 *     TabRouter answers GO_BACK with null whenever its own history holds a
 *     single entry, and that history only grows through changeIndex, which runs
 *     for router-handled NAVIGATE actions. A cross-tab push builds its own
 *     state, never reaches changeIndex, and so leaves the history empty. The
 *     action bubbles to the root, which lands on the initial route: Discover.
 *
 *   - Tabs that own a Stack keep it. Pushing projects/[id]/preview from Search
 *     switches to the projects tab -- briefly showing whatever preview was last
 *     left on its stack -- then pushes on top of it, so back reveals that
 *     unrelated project rather than returning to Search.
 *
 * So the origin travels with the navigation: every link stamps the current
 * pathname onto the route as `from`, and the destination's back button returns
 * there explicitly. Chaining works, because each push carries its own origin.
 *
 * (app) is now a Stack that holds the tabs, with these screens pushed over
 * them, so back is correct by construction. This module and the OWNED_BY map in
 * the tab bar are an interim leftover until the next task removes them.
 */
import { useCallback } from "react";
import { useRouter, usePathname } from "expo-router";

/** Opens a user's profile, remembering where from. */
export function useOpenProfile() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (userId: string) => {
      router.push({
        pathname: "/(app)/users/[id]",
        params: { id: userId, from: pathname },
      });
    },
    [router, pathname]
  );
}

/** Opens a project preview, remembering where from. */
export function useOpenProjectPreview() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (projectId: string) => {
      router.push({
        pathname: "/(app)/projects/[id]/preview",
        params: { id: projectId, from: pathname },
      });
    },
    [router, pathname]
  );
}

/**
 * Back handler for a screen reached through one of the links above.
 *
 * Now that (app) is a Stack over the tabs, a plain back is right whenever
 * there is something to go back to; navigating to `from` instead would push a
 * second copy of the tabs. `from` (the pathname the opener stamped on the
 * route) is used only when there is no history, e.g. after a deep link, and
 * Discover after that, so the button is never dead.
 *
 * Interim: the next task removes this hook along with the rest of the module.
 */
export function useBackToOrigin(from: string | undefined, fallback = "/(app)") {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (from) {
      router.navigate(from as never);
      return;
    }
    router.navigate(fallback as never);
  }, [from, fallback, router]);
}
