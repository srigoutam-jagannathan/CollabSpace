import { supabase } from "@/lib/supabaseClient";
import { matchedRoles } from "./ranking";
import type { ActiveItem, NeedsItem, PersonItem, PulseItem } from "./types";

export interface QueryResult<T> {
  data: T[];
  error: string | null;
}

const PULSE_WINDOW_HOURS = 48;
const ACTIVE_WINDOW_DAYS = 7;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

/**
 * Recent joins and MOU signings.
 * member_quit is deliberately excluded — a public feed of people leaving
 * projects is socially corrosive on a small campus network.
 */
export async function fetchPulse(): Promise<QueryResult<PulseItem>> {
  const { data, error } = await supabase
    .from("collaboration_events")
    .select("id, created_at, event_type, project_id, projects(title), profiles(id, full_name, avatar_url)")
    .in("event_type", ["join", "mou_signed"])
    .gt("created_at", hoursAgo(PULSE_WINDOW_HOURS))
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return { data: [], error: "Couldn't load recent activity." };

  const rows: PulseItem[] = (data ?? []).map((e: any) => ({
    id: e.id,
    created_at: e.created_at,
    event_type: e.event_type,
    project_id: e.project_id,
    project_title: e.projects?.title ?? "a project",
    actor_id: e.profiles?.id ?? "",
    actor_name: e.profiles?.full_name ?? null,
    actor_avatar_url: e.profiles?.avatar_url ?? null,
  }));
  return { data: rows, error: null };
}

/**
 * Recruiting projects the viewer is not already in, annotated with the roles
 * that match their skills. Ordering and the zero-match cut happen in ranking.ts.
 */
export async function fetchNeeds(
  viewerId: string,
  viewerSkills: string[],
  memberProjectIds: string[]
): Promise<QueryResult<NeedsItem>> {
  let query = supabase
    .from("projects")
    .select("id, title, description, looking_for, role_requirements, tags, university_scope, commitment_hours, project_members(count)")
    .eq("status", "recruiting")
    .neq("owner_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (memberProjectIds.length > 0) {
    query = query.not("id", "in", `(${memberProjectIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: "Couldn't load matched projects." };

  const rows: NeedsItem[] = (data ?? []).map((p: any) => {
    // Create Project writes roles to role_requirements ({ role, description }[]).
    // looking_for is the older string[] and is empty on every row written by the
    // current form, so prefer role_requirements and fall back for legacy rows.
    const roles: string[] =
      (p.role_requirements ?? []).map((r: any) => r?.role).filter(Boolean);
    const lookingFor = roles.length > 0 ? roles : (p.looking_for ?? []);

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      looking_for: lookingFor,
      tags: p.tags ?? [],
      university_scope: p.university_scope,
      commitment_hours: p.commitment_hours,
      member_count: p.project_members?.[0]?.count ?? 0,
      matched_roles: matchedRoles(lookingFor, viewerSkills),
    };
  });
  return { data: rows, error: null };
}

/** Projects with at least one collaboration event in the last 7 days. */
export async function fetchActive(): Promise<QueryResult<ActiveItem>> {
  const { data: events, error: eventsError } = await supabase
    .from("collaboration_events")
    .select("project_id")
    .gt("created_at", hoursAgo(ACTIVE_WINDOW_DAYS * 24));

  if (eventsError) return { data: [], error: "Couldn't load active projects." };

  const counts = new Map<string, number>();
  (events ?? []).forEach((e: any) => {
    counts.set(e.project_id, (counts.get(e.project_id) ?? 0) + 1);
  });
  const ids = [...counts.keys()];
  if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, description, project_health")
    .in("id", ids)
    .neq("status", "completed")
    .limit(30);

  if (error) return { data: [], error: "Couldn't load active projects." };

  const rows: ActiveItem[] = (data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    project_health: p.project_health,
    event_count: counts.get(p.id) ?? 0,
  }));
  return { data: rows, error: null };
}

/** Everyone except the viewer, the deleted, and existing accepted connections. */
export async function fetchPeople(viewerId: string): Promise<QueryResult<PersonItem>> {
  const { data: connections } = await supabase
    .from("connections")
    .select("requester_id, recipient_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`);

  const connected = new Set<string>(
    (connections ?? []).map((c: any) =>
      c.requester_id === viewerId ? c.recipient_id : c.requester_id
    )
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, university, pvs_score")
    .neq("id", viewerId)
    .is("deleted_at", null)
    .order("pvs_score", { ascending: false })
    .limit(40);

  if (error) return { data: [], error: "Couldn't load people." };

  const rows: PersonItem[] = (data ?? [])
    .filter((p: any) => !connected.has(p.id))
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      department: p.department,
      university: p.university,
      pvs_score: p.pvs_score ?? 0,
    }));
  return { data: rows, error: null };
}

/** Project ids the viewer already belongs to — used to exclude them from Needs. */
export async function fetchMemberProjectIds(viewerId: string): Promise<string[]> {
  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", viewerId);
  return (data ?? []).map((m: any) => m.project_id);
}
