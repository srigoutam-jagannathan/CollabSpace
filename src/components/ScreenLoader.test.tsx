import { renderWithProviders } from "@/test/renderWithProviders";
import { ScreenLoader } from "./ScreenLoader";

test("announces itself as progress, named Loading by default", () => {
  const { getByRole } = renderWithProviders(<ScreenLoader />);
  expect(getByRole("progressbar", { name: "Loading" })).toBeTruthy();
});

test("shows and announces a custom label", () => {
  const { getByRole, getByText } = renderWithProviders(<ScreenLoader label="Loading projects" />);
  expect(getByText("Loading projects")).toBeTruthy();
  expect(getByRole("progressbar", { name: "Loading projects" })).toBeTruthy();
});
