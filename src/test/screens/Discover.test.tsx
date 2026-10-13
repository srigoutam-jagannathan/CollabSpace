import { act, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
// The shared mock focuses once on mount. Keep the latest focus callbacks so a
// test can focus the screen again, as returning from a pushed screen does.
const mockFocusEffects = new Map<number, () => void>();
jest.mock("expo-router", () => {
  const { useEffect, useId } = require("react");
  const base = require("@/test/routerMock").expoRouterModule;
  return {
    ...base,
    useFocusEffect: (effect: () => void) => {
      const id = useId();
      mockFocusEffects.set(id, effect);
      useEffect(effect, [effect]);
    },
  };
});
const refocus = () => act(() => { mockFocusEffects.forEach((effect) => effect()); });
const mockAuth = { user: { id: "me" } };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

import DiscoverScreen from "@/features/discover/DiscoverScreen";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has, type QueryCall } from "@/test/supabaseMock";
import { routerState } from "@/test/routerMock";

const MATCHING = {
  id: "n1", title: "Poster Studio", description: "Posters for gigs",
  role_requirements: [{ role: "Design", description: "" }], looking_for: [], tags: [],
  university_scope: "both", commitment_hours: 4, project_members: [{ count: 1 }],
};
const UNRELATED = { ...MATCHING, id: "n2", title: "Contract Clinic", role_requirements: [{ role: "Law", description: "" }] };

type World = {
  /** The viewer's profile row, or "unloaded" for a read that has not come back with one. */
  profile: { skills: string[]; department: string | null } | "unloaded";
  recruiting: unknown[];
  /** The viewer's own recruiting projects, which People to know matches against. */
  mine?: unknown[];
  /** Skills on the one other profile, Pat Person. */
  patSkills?: string[];
};

const filter = (c: QueryCall, method: string, col: string) =>
  c.filters.find(([m, k]) => m === method && k === col);

function world({ profile, recruiting, mine = [], patSkills = [] }: World) {
  db.respond((c) => {
    if (c.table === "profiles" && c.single) {
      return profile === "unloaded"
        ? { data: null, error: { message: "network" } }
        : { data: profile };
    }
    if (c.table === "profiles") {
      return { data: [{ id: "u2", full_name: "Pat Person", avatar_url: null, department: "CS", university: "qub", skills: patSkills }] };
    }
    if (c.table === "collaboration_events") {
      return { data: [{ project_id: "a1" }, { project_id: "a2" }, { project_id: "a1" }] };
    }
    if (c.table === "projects") {
      if (filter(c, "eq", "owner_id")?.[2] === "me") return { data: mine };
      if (filter(c, "eq", "status")?.[2] === "recruiting") return { data: recruiting };
      if (filter(c, "eq", "status")?.[2] === "completed") return { data: [] };
      if (filter(c, "in", "id")) {
        return { data: [
          { id: "a1", title: "Night Market App", description: "", project_health: 80 },
          { id: "a2", title: "Campus Radio", description: "", project_health: 60 },
        ] };
      }
      return { data: [] };
    }
    if (c.table === "connections" || c.table === "collab_invitations") return { data: [], count: 0 };
    return { data: [] };
  });
}

beforeEach(() => {
  db.reset();
  routerState.reset();
});

const renderDiscover = () => renderWithProviders(<DiscoverScreen />);

test("skills but nothing matching: the no-matches prompt, with no see-all", async () => {
  world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [UNRELATED] });
  const screen = renderDiscover();

  expect(await screen.findByText("Nothing needs your skills yet")).toBeTruthy();
  expect(screen.queryByLabelText("See all Projects for you")).toBeNull();
  expect(screen.queryByText("New projects")).toBeNull();
  expect(screen.queryByText("Tell us what you're good at")).toBeNull();
});

test("a matching project shows its card and the see-all", async () => {
  world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [MATCHING, UNRELATED] });
  const screen = renderDiscover();

  expect(await screen.findByText("Poster Studio")).toBeTruthy();
  expect(screen.getByLabelText("See all Projects for you")).toBeTruthy();
  expect(screen.queryByText("Contract Clinic")).toBeNull();
  expect(screen.queryByText("Nothing needs your skills yet")).toBeNull();
});

test("while the profile is unknown, neither prompt shows and needs is not fetched", async () => {
  world({ profile: "unloaded", recruiting: [UNRELATED] });
  const screen = renderDiscover();

  // The other sections have loaded, so the screen has settled.
  expect(await screen.findByText("Pat P.")).toBeTruthy();
  expect(screen.queryByText("Nothing needs your skills yet")).toBeNull();
  expect(screen.queryByText("Tell us what you're good at")).toBeNull();
  // Other people's recruiting projects; reading the viewer's own (for People to know) is fine.
  expect(db.callsTo("projects").some((c) =>
    filter(c, "eq", "status")?.[2] === "recruiting" && has(c, "neq", "owner_id", "me")
  )).toBe(false);
});

test("no skills: the add-skills prompt", async () => {
  world({ profile: { skills: [], department: null }, recruiting: [MATCHING] });
  const screen = renderDiscover();
  expect(await screen.findByText("Tell us what you're good at")).toBeTruthy();
  expect(screen.queryByText("Nothing needs your skills yet")).toBeNull();
});

test("sections appear in the issue's order", async () => {
  world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [MATCHING] });
  const screen = renderDiscover();
  await screen.findByText("Poster Studio");
  await screen.findByText("Pat P.");
  await waitFor(() => expect(screen.getByText("Night Market App")).toBeTruthy());

  const titles = screen
    .getAllByText(/^(Projects for you|Shipped from Belfast|Active this week|People to know)$/)
    .map((t) => t.props.children);
  expect(titles).toEqual(["Projects for you", "Shipped from Belfast", "Active this week", "People to know"]);
});

test("returning from the skills editor picks up the new skills", async () => {
  world({ profile: { skills: [], department: "CS" }, recruiting: [MATCHING] });
  const screen = renderDiscover();
  expect(await screen.findByText("Tell us what you're good at")).toBeTruthy();

  // The viewer adds Design in the skills editor and comes back.
  world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [MATCHING] });
  refocus();

  expect(await screen.findByText("Poster Studio")).toBeTruthy();
  expect(screen.queryByText("Tell us what you're good at")).toBeNull();
  expect(db.callsTo("profiles").filter((c) => c.single && has(c, "eq", "id", "me")).length).toBeGreaterThan(1);
});

describe("People to know", () => {
  const MINE = {
    role_requirements: [{ role: "UX Designer", description: "" }], looking_for: [], tags: [],
  };

  test("someone who can fill a role your project needs says so", async () => {
    world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [], mine: [MINE], patSkills: ["UI/UX"] });
    const screen = renderDiscover();

    expect(await screen.findByText("Can fill UX Designer")).toBeTruthy();
    expect(screen.getByText("Skills your projects need")).toBeTruthy();
    expect(screen.queryByText("Students from your department first")).toBeNull();
  });

  test("with no match, the department line and subtitle", async () => {
    world({ profile: { skills: ["Design"], department: "CS" }, recruiting: [], mine: [MINE], patSkills: ["Law"] });
    const screen = renderDiscover();

    expect(await screen.findByText("Pat P.")).toBeTruthy();
    expect(screen.getByText("Students from your department first")).toBeTruthy();
    expect(screen.getByText("CS · QUB")).toBeTruthy();
    expect(screen.queryByText(/^Can fill/)).toBeNull();
  });
});
