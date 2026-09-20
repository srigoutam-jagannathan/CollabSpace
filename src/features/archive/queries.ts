import { supabase } from "@/lib/supabaseClient";
import type { ArchiveItem, ArchiveMember } from "./types";

/** Avatars a card shows before collapsing into the count label. */
export const FACES_SHOWN = 4;

/** Bounded like every other read in this app. */
export const LIMITS = { deck: 20, rail: 6 } as const;

export interface ArchiveResult {
  data: ArchiveItem[];
  error: string | null;
}

/**
 * Completed projects, newest delivery first, with the team that shipped them.
 *
 * Ordered by updated_at because completed_at does not exist yet — see the note
 * on ArchiveItem.delivered_at.
 */
export async function fetchCompleted(limit: number = LIMITS.deck): Promise<ArchiveResult> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, title, description, updated_at, github_repo_url, figma_url, tags, " +
      "project_members(user_id, profiles!user_id(id, full_name, avatar_url))"
    )
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "Couldn't load the archive." };

  const rows: ArchiveItem[] = (data ?? []).map((p: any) => {
    const members = (p.project_members ?? []) as any[];
    const team: ArchiveMember[] = members
      .map(m => m.profiles)
      .filter(Boolean)
      .slice(0, FACES_SHOWN)
      .map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name ?? null,
        avatar_url: profile.avatar_url ?? null,
      }));

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      delivered_at: p.updated_at,
      github_repo_url: p.github_repo_url,
      figma_url: p.figma_url,
      tags: p.tags ?? [],
      team,
      team_count: members.length,
    };
  });

  return { data: rows, error: null };
}

/** Every member of one completed project — the Connect sheet needs all of them. */
export async function fetchTeam(projectId: string): Promise<ArchiveMember[]> {
  const { data } = await supabase
    .from("project_members")
    .select("user_id, profiles!user_id(id, full_name, avatar_url)")
    .eq("project_id", projectId)
    .limit(50);

  return (data ?? [])
    .map((m: any) => m.profiles)
    .filter(Boolean)
    .map((profile: any) => ({
      id: profile.id,
      full_name: profile.full_name ?? null,
      avatar_url: profile.avatar_url ?? null,
    }));
}
