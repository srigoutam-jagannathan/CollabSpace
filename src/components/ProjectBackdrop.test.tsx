import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProjectBackdrop } from "./ProjectBackdrop";

const ID = "a5e1d000-0000-4000-8000-000000000003";

test("renders the cover image when the project has one", () => {
  const { getByTestId, queryByTestId } = renderWithProviders(
    <ProjectBackdrop projectId={ID} coverUrl="https://example.com/aurora.jpg" />
  );
  expect(getByTestId("project-cover")).toBeTruthy();
  expect(queryByTestId("project-generated")).toBeNull();
});

test("falls back to generated art when there is no cover", () => {
  const { getByTestId, queryByTestId } = renderWithProviders(
    <ProjectBackdrop projectId={ID} />
  );
  expect(getByTestId("project-generated")).toBeTruthy();
  expect(queryByTestId("project-cover")).toBeNull();
});

test("a cover that fails to load degrades to generated art, not a hole", () => {
  const { getByTestId, queryByTestId } = renderWithProviders(
    <ProjectBackdrop projectId={ID} coverUrl="https://example.com/gone.jpg" />
  );
  fireEvent(getByTestId("project-cover"), "error");
  expect(getByTestId("project-generated")).toBeTruthy();
  expect(queryByTestId("project-cover")).toBeNull();
});
