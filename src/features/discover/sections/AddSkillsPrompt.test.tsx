import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AddSkillsPrompt } from "./AddSkillsPrompt";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: (...a: any[]) => mockPush(...a) }) }));

beforeEach(() => mockPush.mockClear());

test("explains why the section is empty", () => {
  const { getByText } = renderWithProviders(<AddSkillsPrompt />);
  expect(getByText("Tell us what you're good at")).toBeTruthy();
});

test("opens the skills editor in the app stack, which saves and pops back", () => {
  const { getByLabelText } = renderWithProviders(<AddSkillsPrompt />);
  fireEvent.press(getByLabelText("Add your skills"));
  // The skills screen only returns with back() for from: "settings"; anything
  // else takes the onboarding exit and replaces the stack with home.
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(app)/settings/skills",
    params: { from: "settings" },
  });
});
