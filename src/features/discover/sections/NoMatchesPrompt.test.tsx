import { fireEvent } from "@testing-library/react-native";

jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);

import { renderWithProviders } from "@/test/renderWithProviders";
import { mockRouter, routerState } from "@/test/routerMock";
import { NoMatchesPrompt } from "./NoMatchesPrompt";

beforeEach(() => routerState.reset());

test("says nothing matches yet, and offers Search and Edit skills", () => {
  const screen = renderWithProviders(<NoMatchesPrompt />);
  expect(screen.getByText("Nothing needs your skills yet")).toBeTruthy();

  fireEvent.press(screen.getByLabelText("Browse all projects"));
  expect(mockRouter.push).toHaveBeenCalledWith("/search");

  fireEvent.press(screen.getByLabelText("Edit your skills"));
  // from: "settings" makes the editor save and pop back here, not run the
  // onboarding exit that replaces the stack with home.
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/(app)/settings/skills",
    params: { from: "settings" },
  });
});
