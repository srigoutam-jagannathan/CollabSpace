/**
 * Hand-authored database types for CollabSpace.
 * After running the SQL migration, replace this file with the output of:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type University = "qub" | "ulster";

export type ProjectStatus = "active" | "completed" | "paused" | "recruiting";

export type CollaborationEventType = "join" | "chat" | "milestone" | "commit" | "design_sync" | "mou_signed" | "member_quit";

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
  deleted_at: string | null;
  display_name_at_deletion: string | null;
  expo_push_token: string | null;
}

export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;              // FK → profiles.id
  title: string;
  description: string;
  status: ProjectStatus;
  looking_for: string[];         // Legacy role list. Empty on rows written by the
                                 // current Create Project form — prefer role_requirements.
  role_requirements: { role: string; description: string }[]; // Roles the project needs
  tags: string[];
  university_scope: University | "both";
  project_health: number | null; // 0–100, derived from collaboration_events
  github_repo_url: string | null;
  figma_url: string | null;
  chat_icon_url: string | null;
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
  sender_id: string;
  content: string;
  read_by: string[];
  type: string;
  metadata: Record<string, unknown> | null;
}

export interface DirectMessage {
  id: string;
  created_at: string;
  connection_id: string;
  sender_id: string;
  content: string;
  type: string;
  metadata: Record<string, unknown> | null;
}

export interface ProfileCardMetadata {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  university: string | null;
  department: string | null;
  skills: string[];
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

// ─────────────────────────────────────────────
// Collab Invitations
// ─────────────────────────────────────────────

export type InvitationStatus = "pending" | "accepted" | "declined";

export interface CollabInvitation {
  id: string;
  created_at: string;
  project_id: string;
  sender_id: string;
  recipient_id: string;
  role: string;
  message: string;
  status: InvitationStatus;
}

export interface CollabInvitationNotif {
  id: string;
  projectId: string;
  projectTitle: string;
  projectType: string | null;
  projectTags: string[];
  senderName: string;
  senderAvatarUrl: string | null;
  role: string;
  message: string;
  createdAt: string;
}
