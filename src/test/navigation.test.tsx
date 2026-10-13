/**
 * Back-stack behaviour of the authenticated app, through Expo Router's real
 * navigators. The layouts are the real ones; screens are stubs.
 *
 * Each case was a bug while (app) was a Tabs navigator with the detail
 * screens registered as href:null tabs, or while the chat rooms lived inside
 * the (tabs) group.
 */
import { useEffect } from "react";
import { Text } from "react-native";
import * as fs from "fs";
import * as path from "path";
import { act, fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "u1" } }),
}));

// The whole module, not just its default: renderRouter turns a bare component
// into { default }, which would drop the layout's unstable_settings
// (initialRouteName) that the deep-link case depends on.
import * as AppLayoutModule from "../../app/(app)/_layout";
import TabsLayout from "../../app/(app)/(tabs)/_layout";
import ProjectsLayout from "../../app/(app)/projects/_layout";
import SettingsLayout from "../../app/(app)/settings/_layout";
import EditSkillsScreen from "../../app/(app)/settings/skills";
import CreateProjectScreen from "../../app/(app)/projects/create";
import { db } from "@/test/supabaseMock";

const stub = (label: string) => {
  const Stub = () => <Text>{label}</Text>;
  Stub.displayName = label;
  return Stub;
};

/** A stub that shows its [id], so two instances of one route can be told apart. */
const withId = (label: string) => {
  const Stub = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <Text>{`${label} ${id}`}</Text>;
  };
  Stub.displayName = label;
  return Stub;
};

// How many tab navigators are mounted. Pushing a route inside (tabs) from a
// screen above it would mount a second one, with its own unread-badge
// subscription.
let tabsMounted = 0;
function CountedTabsLayout() {
  useEffect(() => {
    tabsMounted += 1;
    return () => {
      tabsMounted -= 1;
    };
  }, []);
  return <TabsLayout />;
}

type NavState = { routes: { name: string; state?: NavState }[] } | undefined;

/** How many (tabs) routes the navigation state holds, at any depth. */
function countTabsRoutes(state: NavState): number {
  return (state?.routes ?? []).reduce(
    (n, r) => n + (r.name === "(tabs)" ? 1 : 0) + countTabsRoutes(r.state),
    0
  );
}

/** The state of the first (tabs) route, at any depth. */
function findTabsState(state: NavState): NavState {
  for (const r of state?.routes ?? []) {
    if (r.name === "(tabs)" && r.state) return r.state;
    const inner = findTabsState(r.state);
    if (inner) return inner;
  }
  return undefined;
}

const ROUTES = {
  "(app)/_layout": AppLayoutModule,
  "(app)/(tabs)/_layout": CountedTabsLayout,
  "(app)/(tabs)/index": stub("Discover screen"),
  "(app)/(tabs)/search": stub("Search screen"),
  "(app)/(tabs)/fab": stub("Fab placeholder"),
  "(app)/(tabs)/chat": stub("Chat list"),
  "(app)/(tabs)/profile": stub("Profile screen"),
  "(app)/chat/[id]": withId("Chat room"),
  "(app)/projects/_layout": ProjectsLayout,
  "(app)/projects/index": stub("My projects"),
  "(app)/projects/create": CreateProjectScreen,
  "(app)/projects/[id]/preview": withId("Preview"),
  "(app)/settings/_layout": SettingsLayout,
  "(app)/settings/index": stub("Settings screen"),
  "(app)/settings/skills": EditSkillsScreen,
  "(app)/users/[id]": withId("User"),
};

beforeEach(async () => {
  db.reset();
  tabsMounted = 0;
  await AsyncStorage.setItem("skills_set_u1", "true");
});

test("back from a second preview does not reveal the first", async () => {
  renderRouter(ROUTES, { initialUrl: "/search" });
  expect(await screen.findByText("Search screen")).toBeTruthy();

  act(() => router.push("/(app)/projects/p1/preview"));
  expect(await screen.findByText("Preview p1")).toBeTruthy();
  act(() => router.back());
  expect(await screen.findByText("Search screen")).toBeTruthy();

  act(() => router.navigate("/"));
  expect(await screen.findByText("Discover screen")).toBeTruthy();
  act(() => router.push("/(app)/projects/p2/preview"));
  expect(await screen.findByText("Preview p2")).toBeTruthy();
  act(() => router.back());

  expect(await screen.findByText("Discover screen")).toBeTruthy();
  expect(screen.queryByText("Preview p1")).toBeNull();
});

test("a chat room opened from a preview returns to the preview, over one tab navigator", async () => {
  const app = renderRouter(ROUTES, { initialUrl: "/search" });
  expect(await screen.findByText("Search screen")).toBeTruthy();

  act(() => router.push("/(app)/projects/p1/preview"));
  expect(await screen.findByText("Preview p1")).toBeTruthy();
  act(() => router.push("/(app)/chat/p1"));
  expect(await screen.findByText("Chat room p1")).toBeTruthy();
  expect(tabsMounted).toBe(1);
  expect(countTabsRoutes(app.getRouterState() as NavState)).toBe(1);

  act(() => router.back());
  expect(await screen.findByText("Preview p1")).toBeTruthy();
  expect(app.getPathname()).toBe("/projects/p1/preview");
  expect(tabsMounted).toBe(1);
  expect(countTabsRoutes(app.getRouterState() as NavState)).toBe(1);
});

test("leaving a project from its chat room keeps the tabs underneath", async () => {
  renderRouter(ROUTES, { initialUrl: "/chat/p1" });
  expect(await screen.findByText("Chat room p1")).toBeTruthy();

  act(() => router.replace("/(app)/projects"));
  expect(await screen.findByText("My projects")).toBeTruthy();
  expect(router.canGoBack()).toBe(true);

  act(() => router.back());
  expect(await screen.findByText("Discover screen")).toBeTruthy();
});

test("a deep link to a profile still has the tabs to go back to", async () => {
  renderRouter(ROUTES, { initialUrl: "/users/u2" });
  expect(await screen.findByText("User u2")).toBeTruthy();
  expect(router.canGoBack()).toBe(true);
  act(() => router.back());
  expect(await screen.findByText("Discover screen")).toBeTruthy();
});

const FIVE_TABS = ["chat", "fab", "index", "profile", "search"];

test("only the five tabs live in (tabs)", async () => {
  const dir = path.join(__dirname, "../../app/(app)/(tabs)");
  const files = fs
    .readdirSync(dir)
    .map((f) => f.replace(/\.tsx?$/, ""))
    .filter((f) => f !== "_layout")
    .sort();
  expect(files).toEqual(FIVE_TABS);

  const app = renderRouter(ROUTES, { initialUrl: "/search" });
  expect(await screen.findByText("Search screen")).toBeTruthy();
  const tabsState = findTabsState(app.getRouterState() as NavState);
  expect(tabsState?.routes.map((r) => r.name).sort()).toEqual(FIVE_TABS);
});

test("back from a profile opened from Settings lands on Settings", async () => {
  renderRouter(ROUTES, { initialUrl: "/settings" });
  expect(await screen.findByText("Settings screen")).toBeTruthy();

  act(() => router.push({ pathname: "/(app)/users/[id]", params: { id: "u2" } }));
  expect(await screen.findByText("User u2")).toBeTruthy();
  act(() => router.back());
  expect(await screen.findByText("Settings screen")).toBeTruthy();
});

test("editing skills from Settings returns to Settings, on back and on save", async () => {
  // It used to open (onboarding)/skills, outside the (app) Stack, so back fell
  // through to the home screen (QA, 2026-10-03).
  renderRouter(ROUTES, { initialUrl: "/settings" });
  expect(await screen.findByText("Settings screen")).toBeTruthy();

  act(() => router.push({ pathname: "/(app)/settings/skills", params: { from: "settings" } }));
  expect(await screen.findByText("Save")).toBeTruthy();
  act(() => router.back());
  expect(await screen.findByText("Settings screen")).toBeTruthy();

  act(() => router.push({ pathname: "/(app)/settings/skills", params: { from: "settings" } }));
  await act(async () => {
    fireEvent.press(await screen.findByText("Save"));
  });
  expect(await screen.findByText("Settings screen")).toBeTruthy();
});

test("Create Project's guard holds on the real router: back from step 2 goes to step 1, not out", async () => {
  renderRouter(ROUTES, { initialUrl: "/projects/create" });
  expect(await screen.findByText("Step 1 of 4")).toBeTruthy();

  fireEvent.press(screen.getByLabelText("Passion project"));
  expect(await screen.findByText("Step 2 of 4")).toBeTruthy();

  act(() => router.back());
  expect(await screen.findByText("Step 1 of 4")).toBeTruthy();
  expect(screen.queryByText("Discover screen")).toBeNull();
});
