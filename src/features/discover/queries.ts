import { supabase } from "@/lib/supabaseClient";
import { matchedRoles } from "./ranking";
import type { ActiveItem, NeedsItem, PersonItem, PulseItem, ShippedItem } from "./types";

export interface QueryResult<T> {
  data: T[];
  error: string | null;
}

const PULSE_WINDOW_HOURS = 48;
const ACTIVE_WINDOW_DAYS = 7;

/**
 * How many rows each query may read.
 *
 * Every query is bounded — no unbounded table reads. `section` is what the
 * Discover screen needs to fill a rail; `seeAll` is the wider window the
 * see-all screen ranks over. Ranking for needs, active and people all happens
 * client-side (match count, event count, shared department), so these are
 * genuinely the sets being ordered, not a server-side page of an ordered set.
 * That is why the see-all screen pages through the ranked array rather than
 * calling .range() — a .range() page would be ordered by the wrong key.
 */
export const WINDOW = {
  section: { needs: 50, active: 30, people: 40, shipped: 6 },
  seeAll: { needs: 200, active: 200, people: 200 },
  /** Supporting reads that only ever describe the viewer. */
  viewerMemberships: 200,
  viewerConnections: 500,
  /** Events counted when ranking Active right now. */
  activeEvents: 1000,
} as const;

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
  memberProjectIds: string[],
  limit: number = WINDOW.section.needs
): Promise<QueryResult<NeedsItem>> {
  let query = supabase
    .from("projects")
    .select("id, title, description, looking_for, role_requirements, tags, university_scope, commitment_hours, project_members(count)")
    .eq("status", "recruiting")
    .neq("owner_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);

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

/**
 * Projects with at least one collaboration event in the last 7 days.
 *
 * Event counts are taken over the most recent WINDOW.activeEvents events in
 * the window rather than every row in the table. Past that ceiling the
 * ordering between two very busy projects can blur, which is a far better
 * failure than an unbounded read of an append-only audit log.
 */
export async function fetchActive(
  limit: number = WINDOW.section.active
): Promise<QueryResult<ActiveItem>> {
  const { data: events, error: eventsError } = await supabase
    .from("collaboration_events")
    .select("project_id")
    .gt("created_at", hoursAgo(ACTIVE_WINDOW_DAYS * 24))
    .order("created_at", { ascending: false })
    .limit(WINDOW.activeEvents);

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
    .limit(limit);

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
export async function fetchPeople(
  viewerId: string,
  limit: number = WINDOW.section.people
): Promise<QueryResult<PersonItem>> {
  // Bounded like every other read. A viewer with more accepted connections
  // than this would start seeing an already-connected person in the rail —
  // a cosmetic duplicate, not a data leak — and no student network on two
  // campuses comes close to the ceiling.
  const { data: connections } = await supabase
    .from("connections")
    .select("requester_id, recipient_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`)
    .limit(WINDOW.viewerConnections);

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
    .limit(limit);

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
    .eq("user_id", viewerId)
    .limit(WINDOW.viewerMemberships);
  return (data ?? []).map((m: any) => m.project_id);
}

/** Faces shown per tile before the rest are dropped. */
const RAIL_FACES = 4;

/**
 * Completed projects for the Shipped rail — the doorway into the Archive.
 *
 * Queried here rather than imported from src/features/archive so the two
 * features stay independent, per the repo's no-cross-feature-imports rule.
 * The rail needs far less than the deck does: no description, no proof links.
 */
export async function fetchShipped(
  limit: number = WINDOW.section.shipped
): Promise<QueryResult<ShippedItem>> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, updated_at, cover_url, project_members(user_id, profiles!user_id(id, full_name, avatar_url))")
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "Couldn't load shipped projects." };

  const rows: ShippedItem[] = (data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    delivered_at: p.updated_at,
    cover_url: p.cover_url ?? null,
    faces: ((p.project_members ?? []) as any[])
      .map(m => m.profiles)
      .filter(Boolean)
      .slice(0, RAIL_FACES)
      .map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name ?? null,
        avatar_url: profile.avatar_url ?? null,
      })),
  }));

  return { data: rows, error: null };
}
