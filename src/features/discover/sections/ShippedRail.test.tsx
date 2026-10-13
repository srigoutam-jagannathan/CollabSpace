jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);

import { renderWithProviders } from "@/test/renderWithProviders";
import { ShippedRail } from "./ShippedRail";
import { withExampleShipped } from "../ranking";

test("example tiles say so, visibly and to screen readers", () => {
  const screen = renderWithProviders(<ShippedRail items={withExampleShipped([])} />);
  expect(screen.getAllByText("EXAMPLE")).toHaveLength(5);
  expect(screen.getAllByLabelText(/^Example project: /)).toHaveLength(5);
});
