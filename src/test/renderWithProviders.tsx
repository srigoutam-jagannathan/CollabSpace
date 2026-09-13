import type { ReactElement } from "react";
import { render } from "@testing-library/react-native";

/**
 * Renders a component for test. Theme is mocked globally in jest.setup.js,
 * so no provider wrapper is needed today — this indirection exists so that
 * adding one later touches a single file.
 */
export function renderWithProviders(ui: ReactElement) {
  return render(ui);
}
