import { generateIdentity, hashId } from "./projectIdentity";

const ids = [
  "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "b3abbc81-69b3-4995-a301-c9adb59c3908",
  "9f47f6c5-1bcc-499c-b52b-cd54e3a70fcc",
  "fa57d1e4-c3db-4745-b98f-a650299e1ea0",
  "259703f6-73ca-47ad-87de-3aacd4df3edb",
  "",
];

describe("hashId", () => {
  test("stays an unsigned 32-bit integer", () => {
    for (const id of ids) {
      const h = hashId(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  test("is stable for the same input", () => {
    expect(hashId(ids[0])).toBe(hashId(ids[0]));
  });

  test("separates inputs that differ by one character", () => {
    expect(hashId("project-a")).not.toBe(hashId("project-b"));
  });
});

describe("generateIdentity", () => {
  test("is deterministic — the same project looks the same everywhere", () => {
    for (const id of ids) {
      expect(generateIdentity(id)).toEqual(generateIdentity(id));
    }
  });

  test("only ever emits palette colours and known angles", () => {
    const palette = ["#c08552", "#d4a06a", "#8c5a3c", "#6e4530", "#4b2e2b", "#1a0e0c"];
    const angles = [38, 60, 82, 104, 126];
    const highlights = [0.2, 0.35, 0.5, 0.65, 0.8];

    for (const id of ids) {
      const identity = generateIdentity(id);
      expect(palette).toContain(identity.base[0]);
      expect(palette).toContain(identity.base[1]);
      expect(identity.highlight).toBe(identity.base[0]);
      expect(angles).toContain(identity.angle);
      expect(highlights).toContain(identity.highlightX);
    }
  });

  test("handles an empty id without throwing", () => {
    expect(() => generateIdentity("")).not.toThrow();
  });

  test("spreads a realistic set of ids across the available looks", () => {
    // Not a uniformity proof — just a guard against a bug that collapses
    // every project onto one gradient, which would defeat the point.
    const many = Array.from({ length: 200 }, (_, i) => `project-${i}-abcdef`);
    const looks = new Set(many.map(id => {
      const x = generateIdentity(id);
      return `${x.base[0]}|${x.angle}`;
    }));
    expect(looks.size).toBeGreaterThan(8);
  });
});
