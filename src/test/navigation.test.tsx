/**
 * Back-stack behaviour of the authenticated app, through Expo Router's real
 * navigators. The layouts are the real ones; screens are stubs.
 *
 * Both cases were bugs while (app) was a Tabs navigator with the detail
 * screens registered as href:null tabs: back went to the first tab instead.
 */
import { Text } from "react-native";
import { act } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { router } from "expo-router";
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
import { db } from "@/test/supabaseMock";

const stub = (label: string) => {
  const Stub = () => <Text>{label}</Text>;
  Stub.displayName = label;
  return Stub;
};

const ROUTES = {
  "(app)/_layout": AppLayoutModule,
  "(app)/(tabs)/_layout": TabsLayout,
  "(app)/(tabs)/index": stub("Discover screen"),
  "(app)/(tabs)/search": stub("Search screen"),
  "(app)/(tabs)/fab": stub("Fab placeholder"),
  "(app)/(tabs)/chat/index": stub("Chat list"),
  "(app)/(tabs)/profile": stub("Profile screen"),
  "(app)/projects/[id]/join": stub("Join screen"),
  "(app)/settings/index": stub("Settings screen"),
  "(app)/users/[id]": stub("User screen"),
};

beforeEach(async () => {
  db.reset();
  await AsyncStorage.setItem("skills_set_u1", "true");
});

test("Discover → Join → back returns to Discover", async () => {
  renderRouter(ROUTES, { initialUrl: "/" });
  expect(await screen.findByText("Discover screen")).toBeTruthy();
  act(() => router.push("/(app)/projects/p1/join"));
  expect(await screen.findByText("Join screen")).toBeTruthy();
  act(() => router.back());
  expect(await screen.findByText("Discover screen")).toBeTruthy();
});

test("Profile → Settings → back returns to Profile", async () => {
  renderRouter(ROUTES, { initialUrl: "/profile" });
  expect(await screen.findByText("Profile screen")).toBeTruthy();
  act(() => router.push("/(app)/settings"));
  expect(await screen.findByText("Settings screen")).toBeTruthy();
  act(() => router.back());
  expect(await screen.findByText("Profile screen")).toBeTruthy();
});

test("a deep link to a profile still has the tabs to go back to", async () => {
  renderRouter(ROUTES, { initialUrl: "/users/u2" });
  expect(await screen.findByText("User screen")).toBeTruthy();
  expect(router.canGoBack()).toBe(true);
  act(() => router.back());
  expect(await screen.findByText("Discover screen")).toBeTruthy();
});
