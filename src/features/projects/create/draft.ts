import { canonicalSkill } from "@/constants/skills";
import type { CollabStyle, Duration } from "@/constants/projectOptions";

/** Everything the four create steps collect. Lives in CreateProject so going back loses nothing. */
export interface ProjectDraft {
  projectType: string | null;
  title: string;
  description: string;
  /** "" when the owner didn't pick one. */
  ownerRole: string;
  roles: string[];
  openToLearners: boolean;
  duration: Duration | null;
  collabStyle: CollabStyle | null;
  commitmentHours: number | null;
}

export type Step = 1 | 2 | 3 | 4;

export const MIN_TITLE = 3;
export const MIN_DESCRIPTION = 20;

export const EMPTY_DRAFT: ProjectDraft = {
  projectType: null,
  title: "",
  description: "",
  ownerRole: "",
  roles: [],
  openToLearners: false,
  duration: null,
  collabStyle: null,
  commitmentHours: null,
};

/** Whether a step has what it needs for Next (or, on step 4, Post). */
export function stepReady(step: Step, d: ProjectDraft): boolean {
  switch (step) {
    case 1: return d.projectType !== null;
    case 2: return d.title.trim().length >= MIN_TITLE && d.description.trim().length >= MIN_DESCRIPTION;
    case 3: return d.roles.length > 0;
    case 4: return d.duration !== null && d.collabStyle !== null && d.commitmentHours !== null;
  }
}

/** Adds a role, with runs of spaces collapsed, unless it's blank or already there (case-insensitively). */
export function addRole(roles: string[], role: string): string[] {
  const name = role.replace(/\s+/g, " ").trim();
  if (!name || roles.some((r) => r.toLowerCase() === name.toLowerCase())) return roles;
  return [...roles, name];
}

/** Adds a role typed by hand: "design" or "developer" become the preset they mean. */
export function addTypedRole(roles: string[], typed: string): string[] {
  return addRole(roles, canonicalSkill(typed));
}

/** The projects row for a finished draft. */
export function buildProjectInsert(d: ProjectDraft, ownerId: string) {
  const tags = [...new Map(d.roles.map((r) => {
    const skill = canonicalSkill(r);
    return [skill.toLowerCase(), skill] as const;
  })).values()];

  return {
    owner_id: ownerId,
    title: d.title.trim(),
    description: d.description.trim(),
    looking_for: [] as string[],
    tags,
    university_scope: "both" as const,
    status: "recruiting" as const,
    project_type: d.projectType,
    collaboration_style: d.collabStyle,
    team_size: d.roles.length + 1,
    commitment_hours: d.commitmentHours ?? 0,
    start_date: null,
    end_date: null,
    duration: d.duration,
    open_to_learners: d.openToLearners,
    owner_role: d.ownerRole.trim() || null,
    role_requirements: d.roles.map((role) => ({ role, description: "" })),
  };
}
