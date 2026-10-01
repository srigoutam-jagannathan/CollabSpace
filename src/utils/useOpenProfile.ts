/**
 * useOpenProfile — opens a user profile and records where it was opened from.
 *
 * users/[id] is registered as an href:null Tabs.Screen, not a screen inside
 * any stack, so reaching it is a tab switch rather than a push and there is
 * nothing for router.back() to pop. React Navigation's TabRouter answers
 * GO_BACK with null whenever its own history holds a single entry, and that
 * history only grows through router-handled NAVIGATE actions -- a cross-tab
 * push builds its own state and bypasses it. The action then bubbles to the
 * root, which lands on the initial route: Discover, wherever you came from.
 *
 * So the origin travels with the navigation instead. Every profile link goes
 * through this hook, which stamps the current pathname onto the route, and the
 * profile's back button returns there explicitly. Chaining works, because each
 * push carries its own origin.
 *
 * The real fix is structural -- (app) becoming a Stack that holds the tabs,
 * with users/[id] pushed over them, so back is correct by construction.
 */
import { useCallback } from "react";
import { useRouter, usePathname } from "expo-router";

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
