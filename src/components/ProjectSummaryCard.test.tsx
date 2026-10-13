import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProjectSummaryCard } from "./ProjectSummaryCard";

const base = {
  title: "Aurora",
  description: "A night-sky photography app for students.",
  timeframe: "Oct 2026 – Dec 2026 · 5 hrs a week",
  ownerName: "Olive Owner",
  ownerAvatarUrl: null,
};

test("shows the title, description, timeframe and owner", () => {
  const screen = renderWithProviders(<ProjectSummaryCard {...base} />);
  expect(screen.getByText("Aurora")).toBeTruthy();
  expect(screen.getByText("A night-sky photography app for students.")).toBeTruthy();
  expect(screen.getByText("Oct 2026 – Dec 2026 · 5 hrs a week")).toBeTruthy();
  expect(screen.getByText("Olive Owner")).toBeTruthy();
});

test("leaves out the timeframe line when there is none", () => {
  const screen = renderWithProviders(<ProjectSummaryCard {...base} timeframe={null} />);
  expect(screen.queryByText(/a week/)).toBeNull();
});

test("the owner row opens their profile when a handler is given", () => {
  const onOwnerPress = jest.fn();
  const screen = renderWithProviders(<ProjectSummaryCard {...base} onOwnerPress={onOwnerPress} />);
  fireEvent.press(screen.getByLabelText("Started by Olive Owner. Opens their profile."));
  expect(onOwnerPress).toHaveBeenCalledTimes(1);
});

test("without a handler the owner row is plain text", () => {
  const screen = renderWithProviders(<ProjectSummaryCard {...base} />);
  expect(screen.queryByLabelText(/Opens their profile/)).toBeNull();
});
