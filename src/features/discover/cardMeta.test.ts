import { roleMeter, projectPills, MAX_PILLS } from "./cardMeta";
import type { NeedsItem } from "./types";

const base: NeedsItem = {
  id: "p", title: "P", description: "",
  looking_for: [], tags: [], university_scope: "both",
  commitment_hours: null, member_count: 0, matched_roles: [],
};

describe("roleMeter", () => {
  test("reports capacity when the project declared roles", () => {
    expect(roleMeter(1, ["Designer", "Backend Dev"])).toEqual({
      kind: "roles", filled: 1, total: 3, label: "1 of 3 roles filled",
    });
  });

  test("a project with no declared roles never reads as fully staffed", () => {
    // The regression this file exists for: total used to collapse to the
    // member count, so a recruiting project rendered "3 of 3 roles filled".
    const meter = roleMeter(3, []);
    expect(meter.kind).toBe("members");
    expect(meter.label).toBe("3 collaborators");
    expect(meter.label).not.toMatch(/roles filled/);
  });

  test("singular and empty team sizes read correctly", () => {
    expect(roleMeter(1, []).label).toBe("1 collaborator");
    expect(roleMeter(0, []).label).toBe("No members yet");
  });

  test("a negative or missing member count is floored at zero", () => {
    expect(roleMeter(-2, ["Designer"])).toEqual({
      kind: "roles", filled: 0, total: 1, label: "0 of 1 roles filled",
    });
  });
});

describe("projectPills", () => {
  test("leads with the role the viewer matches", () => {
    const pills = projectPills({
      ...base,
      looking_for: ["Designer", "Backend Dev"],
      matched_roles: ["Backend Dev"],
    });
    expect(pills[0]).toEqual({ label: "Backend Dev open", tone: "open" });
  });

  test("falls back to the first open role when nothing matches", () => {
    const pills = projectPills({ ...base, looking_for: ["Designer"] });
    expect(pills[0]).toEqual({ label: "Designer open", tone: "open" });
  });

  test("omits the open-role pill entirely when no roles are declared", () => {
    const pills = projectPills({ ...base, university_scope: "qub" });
    expect(pills.some(p => p.tone === "open")).toBe(false);
    expect(pills[0]).toEqual({ label: "QUB", tone: "plain" });
  });

  test("labels each university scope", () => {
    expect(projectPills({ ...base, university_scope: "qub" })[0].label).toBe("QUB");
    expect(projectPills({ ...base, university_scope: "ulster" })[0].label).toBe("Ulster");
    expect(projectPills({ ...base, university_scope: "both" })[0].label).toBe("QUB + Ulster");
  });

  test("includes commitment hours only when set above zero", () => {
    const labels = (h: number | null) =>
      projectPills({ ...base, commitment_hours: h }).map(p => p.label);
    expect(labels(6)).toContain("6h/wk");
    expect(labels(0)).not.toContain("0h/wk");
    expect(labels(null).some(l => l.endsWith("h/wk"))).toBe(false);
  });

  test("a tag-only match shows that skill once, as the open role", () => {
    const pills = projectPills({ ...base, tags: ["UI/UX"], matched_roles: ["UI/UX"] });
    expect(pills.filter(p => p.label.toLowerCase().includes("ui/ux"))).toEqual([
      { label: "UI/UX open", tone: "open" },
    ]);
  });

  test("fills remaining space with tags and never exceeds the cap", () => {
    const pills = projectPills({
      ...base,
      looking_for: ["Designer"],
      commitment_hours: 6,
      tags: ["AR", "Unity", "Mapping", "Beacons"],
    });
    expect(pills).toHaveLength(MAX_PILLS);
    expect(pills.map(p => p.label)).toEqual([
      "Designer open", "QUB + Ulster", "6h/wk", "AR",
    ]);
  });
});
