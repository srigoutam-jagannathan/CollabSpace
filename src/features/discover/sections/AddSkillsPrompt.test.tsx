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

test("routes to the skills picker", () => {
  const { getByLabelText } = renderWithProviders(<AddSkillsPrompt />);
  fireEvent.press(getByLabelText("Add your skills"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(onboarding)/skills",
    params: { from: "discover" },
  });
});
