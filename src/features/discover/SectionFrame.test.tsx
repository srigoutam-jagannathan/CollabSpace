import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SectionFrame } from "./SectionFrame";

test("renders nothing when the section is not visible", () => {
  const { queryByText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active right now" visible={false} loading={false} error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(queryByText("Active right now")).toBeNull();
  expect(queryByText("child")).toBeNull();
});

test("shows an inline retry when the section errored", () => {
  const onRetry = jest.fn();
  const { getByText, getByLabelText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active right now" visible loading={false} error="Couldn't load active projects." onRetry={onRetry}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByText("Couldn't load active projects.")).toBeTruthy();
  fireEvent.press(getByLabelText("Retry loading Active right now"));
  expect(onRetry).toHaveBeenCalled();
});

test("exposes the title as an accessible header", () => {
  const { getByRole } = renderWithProviders(
    <SectionFrame skeleton="rail" title="People to know" visible loading={false} error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByRole("header", { name: "People to know" })).toBeTruthy();
});

test("hides children while loading but keeps the header", () => {
  const { queryByText, getByRole } = renderWithProviders(
    <SectionFrame skeleton="rail" title="People to know" visible loading error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByRole("header", { name: "People to know" })).toBeTruthy();
  expect(queryByText("child")).toBeNull();
});

test("a section still shows its error and retry", () => {
  const onRetry = jest.fn();
  const { getByText, getByLabelText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active right now" visible loading={false} error="Couldn't load active projects." onRetry={onRetry}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByText("Couldn't load active projects.")).toBeTruthy();
  fireEvent.press(getByLabelText("Retry loading Active right now"));
  expect(onRetry).toHaveBeenCalled();
});
