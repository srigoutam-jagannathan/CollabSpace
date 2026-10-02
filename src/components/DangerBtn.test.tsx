import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DangerBtn } from "./DangerBtn";

test("is a named button that calls onPress", () => {
  const onPress = jest.fn();
  const { getByRole } = renderWithProviders(<DangerBtn label="Leave Project" onPress={onPress} />);
  fireEvent.press(getByRole("button", { name: "Leave Project" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("while loading it shows progress, keeps its name, and cannot be pressed", () => {
  const { getByRole, queryByText } = renderWithProviders(
    <DangerBtn label="Leave Project" onPress={() => {}} loading />
  );
  expect(queryByText("Leave Project")).toBeNull();
  expect(getByRole("button", { name: "Leave Project" })).toBeDisabled();
});

test("disabled is exposed to assistive tech", () => {
  const { getByRole } = renderWithProviders(<DangerBtn label="Leave Project" onPress={() => {}} disabled />);
  expect(getByRole("button", { name: "Leave Project" })).toBeDisabled();
});
