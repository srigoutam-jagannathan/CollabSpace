import { deliveredLabel, teamLabel } from "./format";

describe("deliveredLabel", () => {
  test("names the month and year", () => {
    expect(deliveredLabel("2026-03-14T10:00:00Z")).toBe("Delivered March 2026");
  });

  test("degrades to a bare label rather than 'Invalid Date'", () => {
    expect(deliveredLabel("not-a-date")).toBe("Delivered");
    expect(deliveredLabel("")).toBe("Delivered");
  });
});

describe("teamLabel", () => {
  test("pluralises", () => {
    expect(teamLabel(1)).toBe("1 collaborator");
    expect(teamLabel(4)).toBe("4 collaborators");
  });

  test("says so when a finished project lists nobody", () => {
    expect(teamLabel(0)).toBe("No collaborators listed");
    expect(teamLabel(-3)).toBe("No collaborators listed");
  });
});
