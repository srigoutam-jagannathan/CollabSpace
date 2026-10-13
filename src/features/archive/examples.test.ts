import { withExampleArchive } from "./examples";
import type { ArchiveItem } from "./types";

jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

const real: ArchiveItem = {
  id: "r1", title: "Real", description: "", delivered_at: "2026-09-01T00:00:00Z",
  github_repo_url: null, figma_url: null, tags: [], cover_url: null, team: [], team_count: 2,
};

test("examples top the deck up to five, after the real projects, fully populated", () => {
  const items = withExampleArchive([real]);
  expect(items).toHaveLength(5);
  expect(items[0]).toBe(real);
  for (const ex of items.slice(1)) {
    expect(ex.is_example).toBe(true);
    expect(ex.description.length).toBeGreaterThan(40);
    expect(ex.tags.length).toBeGreaterThan(0);
    expect(ex.team.length).toBeGreaterThan(0);
    expect(ex.team_count).toBeGreaterThanOrEqual(ex.team.length);
  }
});

test("examples never carry links, so nothing points at a made-up repo", () => {
  for (const ex of withExampleArchive([])) {
    expect(ex.github_repo_url).toBeNull();
    expect(ex.figma_url).toBeNull();
  }
});
