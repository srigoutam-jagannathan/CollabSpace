import { Text, StyleSheet } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Btn } from "./Btn";

test("applies layout styles to the element that contains the children", () => {
  const { getByRole } = renderWithProviders(
    <Btn onPress={() => {}} style={{ flexDirection: "row", gap: 8 }}>
      <Text>one</Text>
      <Text>two</Text>
    </Btn>
  );

  const button = getByRole("button");
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({
    flexDirection: "row",
    gap: 8,
  });

  // The children must be direct descendants — no layout-breaking wrapper.
  expect(button.props.children).toHaveLength(2);
});

test("exposes the button role by default", () => {
  const { getByRole } = renderWithProviders(
    <Btn onPress={() => {}}><Text>go</Text></Btn>
  );
  expect(getByRole("button")).toBeTruthy();
});

test("debounces repeated presses within the window", () => {
  const onPress = jest.fn();
  const { getByRole } = renderWithProviders(
    <Btn onPress={onPress} debounceMs={500}><Text>go</Text></Btn>
  );
  const button = getByRole("button");
  // AnimatedPressable's host node exposes low-level responder handlers
  // (onResponderGrant/Release, onClick), not a raw `onPress` prop, so
  // presses must be simulated via fireEvent.press rather than calling
  // button.props.onPress directly.
  fireEvent.press(button);
  fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});
