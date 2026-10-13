import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SectionFrame } from "./SectionFrame";

test("renders nothing when the section is not visible", () => {
  const { queryByText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active this week" visible={false} loading={false} error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(queryByText("Active this week")).toBeNull();
  expect(queryByText("child")).toBeNull();
});

test("shows an inline retry when the section errored", () => {
  const onRetry = jest.fn();
  const { getByText, getByLabelText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active this week" visible loading={false} error="Couldn't load active projects." onRetry={onRetry}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByText("Couldn't load active projects.")).toBeTruthy();
  fireEvent.press(getByLabelText("Retry loading Active this week"));
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

test("title and subtitle are one header stop for a screen reader", () => {
  const { getAllByRole } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active this week" subtitle="Teams making progress" visible loading={false} error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  const headers = getAllByRole("header");
  expect(headers).toHaveLength(1);
  expect(headers[0].props.accessibilityLabel).toBe("Active this week. Teams making progress");
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

test("shows a subtitle under the title when given", () => {
  const { getByText } = renderWithProviders(
    <SectionFrame skeleton="rail" title="Active this week" subtitle="Teams making progress" visible loading={false} error={null} onRetry={() => {}}>
      <Text>child</Text>
    </SectionFrame>
  );
  expect(getByText("Teams making progress")).toBeTruthy();
});
