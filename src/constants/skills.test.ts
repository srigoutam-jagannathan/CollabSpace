import { ALL_SKILLS, SKILL_CATEGORIES, canonicalSkill } from "./skills";

test("the list is the one onboarding has always offered", () => {
  expect(SKILL_CATEGORIES.map((c) => c.title)).toEqual([
    "CREATIVE AND ARTS", "TECH AND DIGITAL", "BUSINESS AND INNOVATION", "SPORTS AND LIFESTYLE",
  ]);
  expect(ALL_SKILLS).toContain("UI/UX");
  expect(ALL_SKILLS).toContain("Coding and Development");
  expect(new Set(ALL_SKILLS).size).toBe(ALL_SKILLS.length);
});

test.each([
  ["UI/UX", "UI/UX"],
  ["  ui/ux ", "UI/UX"],
  ["Frontend Developer", "Coding and Development"],
  ["React Native", "Coding and Development"],
  ["UX Designer", "UI/UX"],
  ["Graphic Designer", "Design"],
  ["Marketer", "Marketing"],
  ["ML Engineer", "AI"],
  ["Video Editor", "Film and Media"],
])("canonicalSkill(%p) is %p", (input, expected) => {
  expect(canonicalSkill(input)).toBe(expected);
});

test("an unknown skill keeps its own wording, trimmed", () => {
  expect(canonicalSkill("  Beekeeping ")).toBe("Beekeeping");
});
