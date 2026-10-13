import { EMPTY_DRAFT, addRole, buildProjectInsert, stepReady, type ProjectDraft } from "./draft";

const full: ProjectDraft = {
  projectType: "Side Project",
  title: "  Aurora ",
  description: "  A night-sky photography app for students.  ",
  ownerRole: "Project Lead",
  roles: ["UX Designer", "UI/UX", "Marketing"],
  openToLearners: true,
  duration: "1_3_months",
  collabStyle: "Remote",
  commitmentHours: 5,
};

describe("stepReady", () => {
  test("step 1 needs a type", () => {
    expect(stepReady(1, EMPTY_DRAFT)).toBe(false);
    expect(stepReady(1, { ...EMPTY_DRAFT, projectType: "Startup" })).toBe(true);
  });

  test("step 2 needs a 3-character title and a 20-character description, ignoring spaces", () => {
    expect(stepReady(2, { ...EMPTY_DRAFT, title: " ab ", description: "x".repeat(20) })).toBe(false);
    expect(stepReady(2, { ...EMPTY_DRAFT, title: "abc", description: ` ${"x".repeat(19)} ` })).toBe(false);
    expect(stepReady(2, { ...EMPTY_DRAFT, title: "abc", description: "x".repeat(20) })).toBe(true);
  });

  test("step 3 needs at least one role", () => {
    expect(stepReady(3, EMPTY_DRAFT)).toBe(false);
    expect(stepReady(3, { ...EMPTY_DRAFT, roles: ["Design"] })).toBe(true);
  });

  test("step 4 needs a duration, a place and weekly hours", () => {
    expect(stepReady(4, { ...EMPTY_DRAFT, duration: "flexible", collabStyle: "Hybrid" })).toBe(false);
    expect(stepReady(4, { ...EMPTY_DRAFT, duration: "flexible", collabStyle: "Hybrid", commitmentHours: 2 })).toBe(true);
  });
});

describe("addRole", () => {
  test("adds a trimmed role", () => {
    expect(addRole(["Design"], "  Beekeeping ")).toEqual(["Design", "Beekeeping"]);
  });

  test("ignores blanks and case-insensitive duplicates", () => {
    expect(addRole(["Design"], "   ")).toEqual(["Design"]);
    expect(addRole(["Design"], "design")).toEqual(["Design"]);
  });
});

describe("buildProjectInsert", () => {
  test("saves the draft as a recruiting project with no exact dates", () => {
    expect(buildProjectInsert(full, "me")).toEqual({
      owner_id: "me",
      title: "Aurora",
      description: "A night-sky photography app for students.",
      looking_for: [],
      tags: ["UI/UX", "Marketing"],
      university_scope: "both",
      status: "recruiting",
      project_type: "Side Project",
      collaboration_style: "Remote",
      team_size: 4,
      commitment_hours: 5,
      start_date: null,
      end_date: null,
      duration: "1_3_months",
      open_to_learners: true,
      owner_role: "Project Lead",
      role_requirements: [
        { role: "UX Designer", description: "" },
        { role: "UI/UX", description: "" },
        { role: "Marketing", description: "" },
      ],
    });
  });

  test("a blank owner role is saved as null", () => {
    expect(buildProjectInsert({ ...full, ownerRole: "  " }, "me").owner_role).toBeNull();
  });
});
