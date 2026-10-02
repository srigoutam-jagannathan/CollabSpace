jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);

import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CollabTabBar } from "./CollabTabBar";
import { mockRouter, routerState } from "@/test/routerMock";

const ROUTES = ["index", "search", "fab", "chat", "profile", "users/[id]", "settings", "notifications", "projects", "discover/[section]", "archive/index"].map(
  (name) => ({ key: `${name}-key`, name })
);

function renderBar(active: string, { hasChatUnread = false, prevented = false } = {}) {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: prevented })), navigate: jest.fn() };
  const onChatTabPress = jest.fn();
  const utils = renderWithProviders(
    <CollabTabBar
      state={{ index: ROUTES.findIndex((r) => r.name === active), routes: ROUTES } as any}
      navigation={navigation as any}
      descriptors={{} as any}
      insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      hasChatUnread={hasChatUnread}
      onChatTabPress={onChatTabPress}
    />
  );
  return { ...utils, navigation, onChatTabPress };
}

beforeEach(() => routerState.reset());

test("every tab has a spoken name", () => {
  const { getByLabelText } = renderBar("index");
  for (const label of ["Discover", "Search", "Create project", "Chats", "Profile"]) {
    expect(getByLabelText(label)).toBeTruthy();
  }
});

test("the active tab is marked selected", () => {
  const { getByLabelText } = renderBar("search");
  expect(getByLabelText("Search")).toBeSelected();
  expect(getByLabelText("Discover")).not.toBeSelected();
});

test.each([
  ["users/[id]", "Discover"],
  ["notifications", "Discover"],
  ["settings", "Profile"],
  ["projects", "Discover"],
  ["discover/[section]", "Discover"],
  ["archive/index", "Discover"],
])("on %s, %s stays lit", (route, tab) => {
  expect(renderBar(route).getByLabelText(tab)).toBeSelected();
});

test("the chat tab lands on the conversation list, not the last conversation", () => {
  const { getByLabelText, navigation, onChatTabPress } = renderBar("index");
  fireEvent.press(getByLabelText("Chats"));
  expect(onChatTabPress).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith("chat", { screen: "index" });
});

test("other tabs navigate plainly", () => {
  const { getByLabelText, navigation } = renderBar("index");
  fireEvent.press(getByLabelText("Search"));
  expect(navigation.navigate).toHaveBeenCalledWith("search");
  expect(navigation.emit).toHaveBeenCalledWith({ type: "tabPress", target: "search-key", canPreventDefault: true });
});

test("a prevented tabPress does not navigate", () => {
  const { getByLabelText, navigation } = renderBar("index", { prevented: true });
  fireEvent.press(getByLabelText("Search"));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test("unread chats are announced, not just dotted", () => {
  expect(renderBar("index", { hasChatUnread: true }).getByLabelText("Chats, unread messages")).toBeTruthy();
});

test("the create button opens the create form", () => {
  fireEvent.press(renderBar("index").getByLabelText("Create project"));
  expect(mockRouter.navigate).toHaveBeenCalledWith("/(app)/projects/create");
});

test("a double tap on create opens the form once", () => {
  const { getByLabelText } = renderBar("index");
  fireEvent.press(getByLabelText("Create project"));
  fireEvent.press(getByLabelText("Create project"));
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});
