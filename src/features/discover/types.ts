import type { University } from "@/types/database";

export type SectionKey = "pulse" | "needs" | "active" | "people" | "shipped";

export interface PulseItem {
  id: string;
  created_at: string;
  event_type: "join" | "mou_signed";
  project_id: string;
  project_title: string;
  actor_id: string;
  actor_name: string | null;
  actor_avatar_url: string | null;
}

export interface NeedsItem {
  id: string;
  title: string;
  description: string;
  looking_for: string[];
  tags: string[];
  university_scope: University | "both";
  commitment_hours: number | null;
  member_count: number;
  /** Roles from looking_for that intersect the viewer's skills. */
  matched_roles: string[];
}

export interface ActiveItem {
  id: string;
  title: string;
  description: string;
  event_count: number;
  project_health: number | null;
}

export interface PersonItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  university: University | null;
  pvs_score: number;
}

/** A completed project, as the Shipped rail needs it. */
export interface ShippedItem {
  id: string;
  title: string;
  /** Delivery time. Taken from updated_at until a completed_at column exists. */
  delivered_at: string;
  /** Full public URL of the cover image, or null to use generated art. */
  cover_url: string | null;
  /** Avatar urls for the stacked faces, already capped. */
  faces: { id: string; avatar_url: string | null; full_name: string | null }[];
}

/** Per-section fetch state. Sections fail and retry independently. */
export interface SectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}
