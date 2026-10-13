import { matchedRoles, rankNeeds, rankActive, rankPeople, sectionVisible } from "./ranking";
import type { ActiveItem, NeedsItem, PersonItem } from "./types";

describe("matchedRoles with canonical skills", () => {
  test("a free-text role matches the preset it means", () => {
    expect(matchedRoles(["Frontend Developer", "Marketer"], ["Coding and Development"])).toEqual(["Frontend Developer"]);
  });

  test("a project's Skills Needed tags count too", () => {
    expect(matchedRoles([], ["UI/UX"], ["Figma", "ui/ux"])).toEqual(["ui/ux"]);
  });

  test("a role and a tag naming the same skill are reported once", () => {
    expect(matchedRoles(["UX Designer"], ["UI/UX"], ["UI/UX"])).toEqual(["UX Designer"]);
  });

  test("blank needs and skills are ignored", () => {
    expect(matchedRoles(["  ", "Design"], ["", "Design"], [" "])).toEqual(["Design"]);
  });

  test("two roles meaning one skill give one entry, the first", () => {
    expect(matchedRoles(["Frontend Developer", "Backend Developer"], ["Coding and Development"]))
      .toEqual(["Frontend Developer"]);
  });

  test("custom skills still match exactly", () => {
    expect(matchedRoles(["Beekeeping"], ["beekeeping"])).toEqual(["Beekeeping"]);
  });
});

describe("matchedRoles", () => {
  test("returns the intersection, case-insensitively", () => {
    expect(matchedRoles(["Backend Dev", "Marketing"], ["backend dev", "AI"]))
      .toEqual(["Backend Dev"]);
  });

  test("returns an empty array when nothing overlaps", () => {
    expect(matchedRoles(["Legal Advisor"], ["Design"])).toEqual([]);
  });

  test("tolerates empty inputs on either side", () => {
    expect(matchedRoles([], ["Design"])).toEqual([]);
    expect(matchedRoles(["Design"], [])).toEqual([]);
  });
});

describe("rankNeeds", () => {
  const base = {
    description: "", looking_for: [], tags: [], university_scope: "both" as const,
    commitment_hours: null, member_count: 0, matched_roles: [],
  };
  const rows: NeedsItem[] = [
    { ...base, id: "a", title: "A", matched_roles: ["Design"] },
    { ...base, id: "b", title: "B", matched_roles: ["Design", "AI"] },
    { ...base, id: "c", title: "C", matched_roles: [] },
  ];

  test("drops rows with no matched roles", () => {
    expect(rankNeeds(rows).map(r => r.id)).not.toContain("c");
  });

  test("orders by match count descending", () => {
    expect(rankNeeds(rows).map(r => r.id)).toEqual(["b", "a"]);
  });

  test("caps at three by default", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...base, id: String(i), title: String(i), matched_roles: ["Design"],
    }));
    expect(rankNeeds(many)).toHaveLength(3);
  });

  test("honours an explicit limit", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...base, id: String(i), title: String(i), matched_roles: ["Design"],
    }));
    expect(rankNeeds(many, Infinity)).toHaveLength(9);
  });

  test("does not mutate the input array", () => {
    const copy = [...rows];
    rankNeeds(rows);
    expect(rows).toEqual(copy);
  });
});

describe("rankActive", () => {
  test("orders by event count, then project_health", () => {
    const rows: ActiveItem[] = [
      { id: "a", title: "A", description: "", event_count: 2, project_health: 10 },
      { id: "b", title: "B", description: "", event_count: 5, project_health: 10 },
      { id: "c", title: "C", description: "", event_count: 2, project_health: 90 },
    ];
    expect(rankActive(rows).map(r => r.id)).toEqual(["b", "c", "a"]);
  });

  test("treats null project_health as zero", () => {
    const rows: ActiveItem[] = [
      { id: "a", title: "A", description: "", event_count: 1, project_health: null },
      { id: "b", title: "B", description: "", event_count: 1, project_health: 1 },
    ];
    expect(rankActive(rows).map(r => r.id)).toEqual(["b", "a"]);
  });

  test("does not mutate the input array", () => {
    const rows: ActiveItem[] = [
      { id: "a", title: "A", description: "", event_count: 1, project_health: 1 },
      { id: "b", title: "B", description: "", event_count: 9, project_health: 1 },
    ];
    const copy = [...rows];
    rankActive(rows);
    expect(rows).toEqual(copy);
  });
});

describe("rankPeople", () => {
  test("puts people from the viewer's department first, then higher pvs", () => {
    const rows: PersonItem[] = [
      { id: "a", full_name: "A", avatar_url: null, department: "Law", university: "qub", pvs_score: 90 },
      { id: "b", full_name: "B", avatar_url: null, department: "CS", university: "qub", pvs_score: 10 },
      { id: "c", full_name: "C", avatar_url: null, department: "CS", university: "qub", pvs_score: 50 },
    ];
    expect(rankPeople(rows, "CS").map(r => r.id)).toEqual(["c", "b", "a"]);
  });

  test("falls back to pvs order when the viewer has no department", () => {
    const rows: PersonItem[] = [
      { id: "a", full_name: "A", avatar_url: null, department: "Law", university: "qub", pvs_score: 10 },
      { id: "b", full_name: "B", avatar_url: null, department: "CS", university: "qub", pvs_score: 80 },
    ];
    expect(rankPeople(rows, null).map(r => r.id)).toEqual(["b", "a"]);
  });

  test("matches department case- and whitespace-insensitively", () => {
    const rows: PersonItem[] = [
      { id: "a", full_name: "A", avatar_url: null, department: "Law", university: "qub", pvs_score: 90 },
      { id: "b", full_name: "B", avatar_url: null, department: " computer science ", university: "qub", pvs_score: 10 },
    ];
    expect(rankPeople(rows, "Computer Science").map(r => r.id)).toEqual(["b", "a"]);
  });
});

describe("sectionVisible", () => {
  test("active needs at least two items, the rest need one", () => {
    expect(sectionVisible("active", 1)).toBe(false);
    expect(sectionVisible("active", 2)).toBe(true);
    expect(sectionVisible("needs", 1)).toBe(true);
    expect(sectionVisible("people", 1)).toBe(true);
  });

  test("every section is hidden when empty", () => {
    (["needs", "active", "people"] as const).forEach(k => {
      expect(sectionVisible(k, 0)).toBe(false);
    });
  });
});

describe("sectionVisible — shipped gate", () => {
  test("hides the rail below five completed projects", () => {
    // A credibility surface showing one item damages the credibility it
    // exists to build, so the doorway to the Archive stays shut until there
    // is enough behind it.
    for (const n of [0, 1, 2, 3, 4]) {
      expect(sectionVisible("shipped", n)).toBe(false);
    }
  });

  test("opens at five and stays open", () => {
    expect(sectionVisible("shipped", 5)).toBe(true);
    expect(sectionVisible("shipped", 6)).toBe(true);
    expect(sectionVisible("shipped", 40)).toBe(true);
  });
});
