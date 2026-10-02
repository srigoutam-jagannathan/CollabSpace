import { Text } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { renderWithProviders } from "./renderWithProviders";
import { render } from "@testing-library/react-native";
import { expoRouterModule, routerState } from "@/test/routerMock";
import { useTheme } from "@/contexts/ThemeContext";

function Probe() {
  const { tokens: { C } } = useTheme();
  return <Text>{C.white}</Text>;
}

test("harness renders a component and resolves the mocked theme", () => {
  const { getByText } = renderWithProviders(<Probe />);
  expect(getByText("#fff8f0")).toBeTruthy();
});

function SafeAreaProbe() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView>
      <Text>insets top {insets.top}</Text>
    </SafeAreaView>
  );
}

test("harness mocks react-native-safe-area-context so SafeAreaView and useSafeAreaInsets work without a provider", () => {
  const { getByText } = renderWithProviders(<SafeAreaProbe />);
  expect(getByText("insets top 0")).toBeTruthy();
});

test("Redirect records where it sent the user", () => {
  routerState.reset();
  const { Redirect } = expoRouterModule;
  const Screen = Redirect as unknown as (props: { href: string }) => null;
  render(<Screen href="/(auth)/sign-in" />);
  expect(Redirect).toHaveBeenCalledTimes(1);
  expect(Redirect.mock.calls[0][0]).toMatchObject({ href: "/(auth)/sign-in" });
});
