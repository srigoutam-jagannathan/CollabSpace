import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ArchivePageAction } from "./ArchivePageAction";
import type { ArchiveItem } from "./types";

jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

const base: ArchiveItem = {
  id: "x", title: "Thing", description: "A description.", delivered_at: "2026-06-12T12:00:00Z",
  github_repo_url: null, figma_url: null, tags: [], cover_url: null,
  team: [], team_count: 0,
};

test("an example page shows the example line and no Connect button", () => {
  const onConnect = jest.fn();
  const screen = renderWithProviders(<ArchivePageAction item={{ ...base, is_example: true }} onConnect={onConnect} />);
  expect(screen.getByText("Example project. Real ones appear here as teams ship.")).toBeTruthy();
  expect(screen.queryByText("Connect with the team")).toBeNull();
  expect(screen.queryByLabelText(/Connect with the team behind/)).toBeNull();
});

test("a real page's button calls onConnect with the item", () => {
  const onConnect = jest.fn();
  const screen = renderWithProviders(<ArchivePageAction item={base} onConnect={onConnect} />);
  expect(screen.queryByText(/Example project/)).toBeNull();
  fireEvent.press(screen.getByLabelText("Connect with the team behind Thing"));
  expect(onConnect).toHaveBeenCalledWith(base);
});
