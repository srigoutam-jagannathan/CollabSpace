/**
 * Example shipped projects, shown on Discover's Shipped from Belfast rail and
 * in the Archive until five real projects have shipped (user decision
 * 2026-10-13). Always labelled "Example" where they're shown. They live in
 * the app, never in the database: no fake accounts, nothing to clean up.
 * First names only, so no example reads as a real student.
 */
export interface ExampleShipped {
  id: string;
  title: string;
  description: string;
  delivered_at: string;
  tags: string[];
  team: string[];
  team_count: number;
}

export const EXAMPLE_SHIPPED: ExampleShipped[] = [
  {
    id: "example-lagan-litter-map",
    title: "Lagan Litter Map",
    description: "A map of litter hotspots along the Lagan towpath, built from volunteer reports and shared with the council's clean-up team.",
    delivered_at: "2026-06-12T12:00:00Z",
    tags: ["Coding and Development", "Data and Robotics"],
    team: ["Aoife", "Ciarán", "Priya", "Tom"],
    team_count: 4,
  },
  {
    id: "example-queens-quarter-food-guide",
    title: "Queen's Quarter Food Guide",
    description: "A student guide to cheap eats around Botanic, with short videos, a weekly deals post and a map of places open late.",
    delivered_at: "2026-05-20T12:00:00Z",
    tags: ["Content Creation", "Social Media"],
    team: ["Niamh", "Josh", "Mei"],
    team_count: 3,
  },
  {
    id: "example-ulster-esports-night",
    title: "Ulster Esports Night",
    description: "A cross-campus tournament night for 64 players, with a live stream, a bracket site and sponsorship from two local cafés.",
    delivered_at: "2026-04-03T12:00:00Z",
    tags: ["Esports", "Marketing"],
    team: ["Conor", "Sara", "Dev", "Erin", "Liam"],
    team_count: 5,
  },
  {
    id: "example-study-buddy-matcher",
    title: "Study Buddy Matcher",
    description: "A web app that pairs students on the same module for focused study sessions, tested with two first-year cohorts.",
    delivered_at: "2026-03-14T12:00:00Z",
    tags: ["UI/UX", "Coding and Development"],
    team: ["Grace", "Oisín"],
    team_count: 2,
  },
  {
    id: "example-titanic-quarter-short",
    title: "Titanic Quarter Short Film",
    description: "A ten-minute short shot around the Titanic Quarter, written, filmed and edited by students from both universities.",
    delivered_at: "2026-02-08T12:00:00Z",
    tags: ["Film and Media", "Writing and Storytelling"],
    team: ["Rory", "Hannah", "Kofi"],
    team_count: 3,
  },
];

/** The rail and the Archive are topped up to this many projects. */
export const SHIPPED_MINIMUM = 5;
