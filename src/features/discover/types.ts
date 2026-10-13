import type { University } from "@/types/database";

export type SectionKey = "needs" | "active" | "people" | "shipped";

export interface NeedsItem {
  id: string;
  title: string;
  description: string;
  looking_for: string[];
  tags: string[];
  university_scope: University | "both";
  commitment_hours: number | null;
  member_count: number;
  /** Roles and Skills Needed tags that intersect the viewer's skills, matched by canonical skill. */
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
  /** The viewer's project needs this person can fill, in the project's wording. */
  matched_skills: string[];
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
  /** An example from src/constants/exampleShipped.ts, not a real project. */
  is_example?: boolean;
}

/** Per-section fetch state. Sections fail and retry independently. */
export interface SectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}
