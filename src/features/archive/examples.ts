import { EXAMPLE_SHIPPED, SHIPPED_MINIMUM } from "@/constants/exampleShipped";
import { FACES_SHOWN } from "./queries";
import type { ArchiveItem } from "./types";

/** Real completed projects first, topped up with labelled examples to SHIPPED_MINIMUM. */
export function withExampleArchive(real: ArchiveItem[]): ArchiveItem[] {
  const needed = Math.max(0, SHIPPED_MINIMUM - real.length);
  const examples: ArchiveItem[] = EXAMPLE_SHIPPED.slice(0, needed).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    delivered_at: e.delivered_at,
    github_repo_url: null,
    figma_url: null,
    tags: e.tags,
    cover_url: null,
    team: e.team.slice(0, FACES_SHOWN).map((name, i) => ({ id: `${e.id}-${i}`, full_name: name, avatar_url: null })),
    team_count: e.team_count,
    is_example: true,
  }));
  return [...real, ...examples];
}
