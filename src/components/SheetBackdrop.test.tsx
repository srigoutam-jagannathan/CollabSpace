import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SheetBackdrop, SheetSurface } from "./SheetBackdrop";

test("the backdrop is a Close button", () => {
  const onPress = jest.fn();
  const { getByRole } = renderWithProviders(<SheetBackdrop onPress={onPress} />);
  fireEvent.press(getByRole("button", { name: "Close" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("the surface renders its content", () => {
  const { getByText } = renderWithProviders(
    <SheetSurface>
      <Text>Body</Text>
    </SheetSurface>
  );
  expect(getByText("Body")).toBeTruthy();
});
