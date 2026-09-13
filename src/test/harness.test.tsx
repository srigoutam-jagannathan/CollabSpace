import { Text } from "react-native";
import { renderWithProviders } from "./renderWithProviders";
import { useTheme } from "@/contexts/ThemeContext";

function Probe() {
  const { tokens: { C } } = useTheme();
  return <Text>{C.white}</Text>;
}

test("harness renders a component and resolves the mocked theme", () => {
  const { getByText } = renderWithProviders(<Probe />);
  expect(getByText("#fff8f0")).toBeTruthy();
});
