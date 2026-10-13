/**
 * The one skill vocabulary, shared by onboarding, Create Project and matching.
 * Icons are chosen by the screens that render categories; this is data only.
 */
export const SKILL_CATEGORIES = [
  { title: "CREATIVE AND ARTS", skills: ["Design", "Visual Arts", "Film and Media", "Game", "Performing Arts", "Writing and Storytelling", "Music", "Animation"] },
  { title: "TECH AND DIGITAL", skills: ["Coding and Development", "UI/UX", "Cybersecurity", "AI", "Data and Robotics", "VR/AR", "Blockchain"] },
  { title: "BUSINESS AND INNOVATION", skills: ["Entrepreneurship", "Marketing", "Finance", "Social Media", "Content Creation"] },
  { title: "SPORTS AND LIFESTYLE", skills: ["Sports and Fitness", "Esports", "Travel and Adventure", "Cooking and Culinary Arts"] },
] as const;

export type Skill = (typeof SKILL_CATEGORIES)[number]["skills"][number];

export const ALL_SKILLS: readonly Skill[] = SKILL_CATEGORIES.flatMap((c) => [...c.skills]);

/** Common role wording → the preset skill it means. Keys are lower-case. */
export const SYNONYMS: Record<string, Skill> = {
  developer: "Coding and Development",
  "software developer": "Coding and Development",
  "software engineer": "Coding and Development",
  programmer: "Coding and Development",
  "frontend developer": "Coding and Development",
  "front-end developer": "Coding and Development",
  "backend developer": "Coding and Development",
  "back-end developer": "Coding and Development",
  "full stack developer": "Coding and Development",
  "web developer": "Coding and Development",
  "mobile developer": "Coding and Development",
  "app developer": "Coding and Development",
  "react native": "Coding and Development",
  coding: "Coding and Development",
  designer: "Design",
  "graphic designer": "Design",
  "graphic design": "Design",
  "ui designer": "UI/UX",
  "ux designer": "UI/UX",
  "ui/ux designer": "UI/UX",
  "product designer": "UI/UX",
  "ui design": "UI/UX",
  "ux design": "UI/UX",
  marketer: "Marketing",
  "marketing lead": "Marketing",
  "social media manager": "Social Media",
  "content creator": "Content Creation",
  copywriter: "Writing and Storytelling",
  writer: "Writing and Storytelling",
  "data scientist": "Data and Robotics",
  "data analyst": "Data and Robotics",
  "ml engineer": "AI",
  "machine learning": "AI",
  "video editor": "Film and Media",
  "video editing": "Film and Media",
  videographer: "Film and Media",
  photographer: "Visual Arts",
  animator: "Animation",
  musician: "Music",
  "game developer": "Game",
  "game designer": "Game",
  founder: "Entrepreneurship",
  accountant: "Finance",
  "security engineer": "Cybersecurity",
  "cybersecurity analyst": "Cybersecurity",
};

const PRESET_BY_LOWER = new Map<string, Skill>(ALL_SKILLS.map((s) => [s.toLowerCase(), s]));

/** Case-, edge- and inner-whitespace-insensitive lookup key. */
function skillKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The preset a skill or role means, or the input itself (trimmed) if none. */
export function canonicalSkill(label: string): string {
  const key = skillKey(label);
  return SYNONYMS[key] ?? PRESET_BY_LOWER.get(key) ?? label.trim();
}
