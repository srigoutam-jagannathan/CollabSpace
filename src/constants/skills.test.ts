import { ALL_SKILLS, SKILL_CATEGORIES, SYNONYMS, canonicalSkill } from "./skills";

test("the list is the one onboarding has always offered", () => {
  expect(SKILL_CATEGORIES.map((c) => c.title)).toEqual([
    "CREATIVE AND ARTS", "TECH AND DIGITAL", "BUSINESS AND INNOVATION", "SPORTS AND LIFESTYLE",
  ]);
  expect(SKILL_CATEGORIES).toEqual([
    { title: "CREATIVE AND ARTS", skills: ["Design", "Visual Arts", "Film and Media", "Game", "Performing Arts", "Writing and Storytelling", "Music", "Animation"] },
    { title: "TECH AND DIGITAL", skills: ["Coding and Development", "UI/UX", "Cybersecurity", "AI", "Data and Robotics", "VR/AR", "Blockchain"] },
    { title: "BUSINESS AND INNOVATION", skills: ["Entrepreneurship", "Marketing", "Finance", "Social Media", "Content Creation"] },
    { title: "SPORTS AND LIFESTYLE", skills: ["Sports and Fitness", "Esports", "Travel and Adventure", "Cooking and Culinary Arts"] },
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

test.each([
  ["Engineer", "Engineer"],
  ["Security", "Security"],
  ["Security Engineer", "Cybersecurity"],
  ["Cybersecurity Analyst", "Cybersecurity"],
  ["full  stack developer", "Coding and Development"],
])("canonicalSkill(%p) is %p (narrow synonyms, whitespace)", (input, expected) => {
  expect(canonicalSkill(input)).toBe(expected);
});

test("the synonym map never shadows a preset and only points at presets", () => {
  const presets = new Set(ALL_SKILLS.map((s) => s.toLowerCase()));
  for (const [key, value] of Object.entries(SYNONYMS)) {
    expect(presets.has(key)).toBe(false);
    expect(ALL_SKILLS).toContain(value);
  }
});

test("an unknown skill keeps its own wording, trimmed", () => {
  expect(canonicalSkill("  Beekeeping ")).toBe("Beekeeping");
});
