/**
 * Hand-authored database types for CollabSpace.
 * After running the SQL migration, replace this file with the output of:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type University = "qub" | "ulster";

export type ProjectStatus = "active" | "completed" | "paused" | "recruiting";

export type CollaborationEventType = "join" | "chat" | "milestone" | "commit" | "design_sync" | "mou_signed";

// ─────────────────────────────────────────────
// Table row types
// ─────────────────────────────────────────────

export interface Profile {
  id: string;                    // UUID — matches auth.users.id
  created_at: string;
  updated_at: string;
  full_name: string | null;
  avatar_url: string | null;
  university: University;
  department: string | null;
  year_of_study: number | null;
  bio: string | null;
  skills: string[];              // e.g. ["Ui/Ux", "Coding and Development"]
  pvs_score: number;             // Project Velocity Score — 0–100, updated by telemetry
  badges: string[];              // e.g. ["Reliable Collaborator", "Great Communicator"]
  portfolio_links: { title: string; url: string }[]; // External portfolio URLs
}

export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;              // FK → profiles.id
  title: string;
  description: string;
  status: ProjectStatus;
  looking_for: string[];         // Roles the project still needs, e.g. ["Backend Dev", "Legal Advisor"]
  tags: string[];
  university_scope: University | "both";
  project_health: number | null; // 0–100, derived from collaboration_events
  github_repo_url: string | null;
  figma_url: string | null;
}

export interface ProjectMember {
  id: string;
  created_at: string;
  project_id: string;            // FK → projects.id
  user_id: string;               // FK → profiles.id
  role: string;                  // e.g. "Backend Dev", "Legal Advisor"
  mou_accepted: boolean;         // Phase 3: MOU acceptance gate
  mou_accepted_at: string | null;
}

export interface CollaborationEvent {
  id: string;
  created_at: string;
  project_id: string;            // FK → projects.id
  user_id: string;               // FK → profiles.id
  event_type: CollaborationEventType;
  metadata: Record<string, unknown> | null; // Flexible payload per event type
  // e.g. for "commit": { repo: "...", sha: "...", message: "..." }
  // e.g. for "milestone": { title: "...", completed: true }
}

export interface ChatMessage {
  id: string;
  created_at: string;
  project_id: string;
  sender_id: string;             // FK → profiles.id
  content: string;
  read_by: string[];             // Array of user_ids who have read it
}

// ─────────────────────────────────────────────
// Composite / view types used across features
// ─────────────────────────────────────────────

export interface ProjectWithOwner extends Project {
  owner: Pick<Profile, "id" | "full_name" | "avatar_url" | "university" | "pvs_score">;
  member_count: number;
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url" | "university" | "pvs_score">;
}
