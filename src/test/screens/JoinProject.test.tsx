import { Alert } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import JoinProjectScreen from "../../../app/(app)/projects/[id]/join";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has, supabase } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

const PROJECT = {
  id: "p1",
  title: "Aurora",
  description: "A night-sky photography app for students.",
  start_date: "2026-10-03",
  end_date: "2026-12-25",
  commitment_hours: 5,
  owner_id: "owner",
  owner: { id: "owner", full_name: "Olive Owner", avatar_url: null },
};

function world({ project = PROJECT as typeof PROJECT | null } = {}) {
  db.respond((c) => {
    if (c.table === "projects") {
      return project ? { data: project } : { data: null, error: { code: "PGRST116", message: "not found" } };
    }
    return undefined;
  });
}

function rolesWorld({ roles, skills, lookingFor }: { roles: string[]; skills: string[]; lookingFor?: string[] }) {
  db.respond((c) => {
    if (c.table === "projects") {
      return {
        data: {
          ...PROJECT,
          role_requirements: roles.map((role) => ({ role, description: "" })),
          looking_for: lookingFor ?? [],
        },
      };
    }
    if (c.table === "profiles") return { data: { skills } };
    return undefined;
  });
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  routerState.setParams({ id: "p1" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

test("shows what you're joining: title, description, timeframe and owner", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  expect(await screen.findByText("Aurora")).toBeTruthy();
  expect(screen.getByText("A night-sky photography app for students.")).toBeTruthy();
  expect(screen.getByText("Oct 2026 – Dec 2026 · 5 hrs a week")).toBeTruthy();
  expect(screen.getByText("Olive Owner")).toBeTruthy();
});

test("tapping the owner opens their profile", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  fireEvent.press(await screen.findByLabelText("Started by Olive Owner. Opens their profile."));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/(app)/users/[id]", params: { id: "owner" } });
});

test("asks for the project with its owner, by id", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  const [call] = db.callsTo("projects");
  expect(has(call, "eq", "id", "p1")).toBe(true);
  expect(call.columns).toContain("owner:profiles!owner_id(");
});

test("if the project can't load, you can still send a request", async () => {
  world({ project: null });
  const screen = renderWithProviders(<JoinProjectScreen />);
  expect(await screen.findByText("Couldn't load this project's details.")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText(/Tell them why/), "Keen to help");
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
});

test("the button says Ask to Join, not Submit", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  expect(screen.getByText("Ask to Join")).toBeTruthy();
  expect(screen.queryByText(/Submit/)).toBeNull();
});

test("says what happens next, naming the owner", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  expect(await screen.findByText(/Olive will see your profile and message/)).toBeTruthy();
});

test("the picked role is spelled out and sent", async () => {
  rolesWorld({ roles: ["Designer"], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  fireEvent.press(await screen.findByLabelText("Role Designer"));
  expect(screen.getByText("Applying as Designer")).toBeTruthy();
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
  expect(db.callsTo("project_members")[0].payload).toMatchObject({ project_id: "p1", user_id: "me", role: "Designer" });
});

test("confirms the request was sent", async () => {
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  fireEvent.changeText(screen.getByPlaceholderText(/Tell them why/), "Keen to help");
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
    "Request sent", expect.stringMatching(/Chats/), expect.any(Array),
  ));
  const buttons = alertSpy.mock.calls[0][2];
  buttons[0].onPress();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test("a project with no owner shows Unknown and no profile link", async () => {
  world({ project: { ...PROJECT, owner: null } as unknown as typeof PROJECT });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  expect(screen.getByText("Unknown")).toBeTruthy();
  expect(screen.queryByLabelText(/Opens their profile/)).toBeNull();
});

test("says so when you've already asked", async () => {
  db.respond((c) => {
    if (c.table === "projects") return { data: PROJECT };
    if (c.table === "project_members") return { data: null, error: { code: "23505", message: "duplicate" } };
    return undefined;
  });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  fireEvent.changeText(screen.getByPlaceholderText(/Tell them why/), "Keen to help");
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
    "Already asked", "You've already asked to join this project.",
  ));
});

test("offers the project's own roles, with the viewer's match picked", async () => {
  rolesWorld({ roles: ["Frontend Developer", "Marketer"], skills: ["Coding and Development"] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await waitFor(() => expect(screen.getByLabelText("Role Frontend Developer")).toBeSelected());
  expect(screen.getByLabelText("Role Marketer")).not.toBeSelected();
  expect(screen.queryByLabelText("Role Legal")).toBeNull();
});

test("a role you tapped before your skills loaded is kept", async () => {
  // The mock answers synchronously, so hold the profiles read back by hand:
  // that table gets a chain whose result resolves only when the test says so.
  rolesWorld({ roles: ["Frontend Developer", "Marketer"], skills: ["Coding and Development"] });
  let releaseSkills!: () => void;
  const skillsArrive = new Promise<{ data: { skills: string[] }; error: null }>((resolve) => {
    releaseSkills = () => resolve({ data: { skills: ["Coding and Development"] }, error: null });
  });
  const realFrom = supabase.from.getMockImplementation()!;
  supabase.from.mockImplementation((table: string) => {
    if (table !== "profiles") return realFrom(table);
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: () => chain,
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => skillsArrive.then(ok, bad),
    };
    return chain as unknown as ReturnType<typeof realFrom>;
  });
  try {
    const screen = renderWithProviders(<JoinProjectScreen />);
    fireEvent.press(await screen.findByLabelText("Role Marketer"));
    expect(screen.getByLabelText("Role Marketer")).toBeSelected();
    await act(async () => { releaseSkills(); await skillsArrive; });
    expect(screen.getByLabelText("Role Marketer")).toBeSelected();
    expect(screen.getByLabelText("Role Frontend Developer")).not.toBeSelected();
  } finally {
    supabase.from.mockImplementation(realFrom);
  }
});

test("sends no role when none is picked", async () => {
  rolesWorld({ roles: ["Marketer"], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  fireEvent.changeText(await screen.findByPlaceholderText(/Tell them why/), "Keen to help");
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
  expect(db.callsTo("project_members")[0].payload).not.toHaveProperty("role");
});

test("a project with no roles shows no role picker", async () => {
  rolesWorld({ roles: [], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  expect(screen.queryByText("Role you'd like")).toBeNull();
  expect(screen.queryByLabelText(/^Role /)).toBeNull();
});

test("legacy projects offer their looking_for roles", async () => {
  rolesWorld({ roles: [], lookingFor: ["Legal"], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  expect(await screen.findByLabelText("Role Legal")).toBeTruthy();
});

test("asks for the project's roles in the same query as its details", async () => {
  rolesWorld({ roles: ["Marketer"], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  expect(db.callsTo("projects")).toHaveLength(1);
  expect(db.callsTo("projects")[0].columns).toContain("role_requirements");
});

test("a refused role says so and clears the pick", async () => {
  db.respond((c) => {
    if (c.table === "projects") {
      return { data: { ...PROJECT, role_requirements: [{ role: "Designer", description: "" }], looking_for: [] } };
    }
    if (c.table === "profiles") return { data: { skills: [] } };
    if (c.table === "project_members") {
      return { data: null, error: { code: "42501", message: "role not offered by this project" } };
    }
    return undefined;
  });
  const screen = renderWithProviders(<JoinProjectScreen />);
  fireEvent.press(await screen.findByLabelText("Role Designer"));
  expect(screen.getByText("Applying as Designer")).toBeTruthy();
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
    "That role isn't open",
    "The project's roles have changed. Pick another, or ask without a role.",
  ));
  expect(screen.queryByText(/Applying as/)).toBeNull();
});

test("a 42501 that is not the role rule shows the generic alert", async () => {
  db.respond((c) => {
    if (c.table === "projects") {
      return { data: { ...PROJECT, role_requirements: [{ role: "Designer", description: "" }], looking_for: [] } };
    }
    if (c.table === "profiles") return { data: { skills: [] } };
    if (c.table === "project_members") {
      return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
    }
    return undefined;
  });
  const screen = renderWithProviders(<JoinProjectScreen />);
  fireEvent.press(await screen.findByLabelText("Role Designer"));
  fireEvent.press(screen.getByText("Ask to Join"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Error", "new row violates row-level security policy"));
  expect(alertSpy).not.toHaveBeenCalledWith("That role isn't open", expect.anything());
});

test("reads the viewer's skills from their own profile", async () => {
  rolesWorld({ roles: ["Marketer"], skills: [] });
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  await waitFor(() => expect(db.callsTo("profiles")).toHaveLength(1));
  const [call] = db.callsTo("profiles");
  expect(call.columns).toBe("skills");
  expect(has(call, "eq", "id", "me")).toBe(true);
});
