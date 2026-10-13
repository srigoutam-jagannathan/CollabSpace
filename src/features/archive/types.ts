export interface ArchiveMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ArchiveItem {
  id: string;
  title: string;
  description: string;
  /**
   * When the project was delivered.
   *
   * Sourced from `updated_at` rather than a dedicated `completed_at` column,
   * which does not exist yet. That makes it the last time the row changed,
   * not strictly the delivery date — accurate in practice, since marking a
   * project completed is the last edit it receives, but it can drift if an
   * owner edits a finished project. The spec's completed_at migration, with a
   * trigger on the status transition, is what makes this exact.
   */
  delivered_at: string;
  github_repo_url: string | null;
  figma_url: string | null;
  tags: string[];
  /** Full public URL of the cover image, or null to use generated art. */
  cover_url: string | null;
  /** Avatars shown on the card, capped. */
  team: ArchiveMember[];
  /** Full team size, which may exceed team.length. */
  team_count: number;
  /** An example from src/constants/exampleShipped.ts, not a real project. */
  is_example?: boolean;
}
