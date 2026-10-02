import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GradientBtn } from "./GradientBtn";

test("is a named button that calls onPress", () => {
  const onPress = jest.fn();
  const { getByRole } = renderWithProviders(<GradientBtn label="Open Chat" onPress={onPress} />);
  fireEvent.press(getByRole("button", { name: "Open Chat" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("while loading it keeps its name and cannot be pressed", () => {
  const { getByRole, queryByText } = renderWithProviders(
    <GradientBtn label="Open Chat" onPress={() => {}} loading />
  );
  expect(queryByText("Open Chat")).toBeNull();
  expect(getByRole("button", { name: "Open Chat" })).toBeDisabled();
});
