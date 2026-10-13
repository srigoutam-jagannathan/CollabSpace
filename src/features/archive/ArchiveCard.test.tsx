import { renderWithProviders } from "@/test/renderWithProviders";
import { ArchiveCard } from "./ArchiveCard";
import type { ArchiveItem } from "./types";

jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

const base: ArchiveItem = {
  id: "x", title: "Thing", description: "A description.", delivered_at: "2026-06-12T12:00:00Z",
  github_repo_url: null, figma_url: null, tags: [], cover_url: null,
  team: [{ id: "t1", full_name: "Aoife", avatar_url: null }], team_count: 1,
};

test("an example card says so, visibly and to screen readers", () => {
  const screen = renderWithProviders(<ArchiveCard item={{ ...base, is_example: true }} />);
  expect(screen.getByText("EXAMPLE")).toBeTruthy();
  expect(screen.getByLabelText(/^Example project: /)).toBeTruthy();
});

test("a real card carries no example label", () => {
  const screen = renderWithProviders(<ArchiveCard item={base} />);
  expect(screen.queryByText("EXAMPLE")).toBeNull();
});
