import { Alert, Linking } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", user_metadata: { full_name: "Ana Lee" } } }),
}));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import ProfileScreen from "../../../app/(app)/(tabs)/profile";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

type Profile = { badges: string[]; portfolio_links: { title: string; url: string }[] };

function world(profile: Profile) {
  db.respond((c) => {
    if (c.table === "profiles") {
      return {
        data: {
          full_name: "Ana Lee", avatar_url: null, department: null, bio: null,
          pvs_score: 0, skills: [], ...profile,
        },
      };
    }
    if (c.table === "projects" || c.table === "project_members") return { data: [] };
    return undefined;
  });
}

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  db.reset();
  routerState.reset();
});

test("placeholder badges, portfolio and feedback are each labelled as examples", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  expect(await screen.findByText("Reliable Collaborator")).toBeTruthy();
  // One tag each for Portfolio, Badges and Latest Feedback.
  expect(screen.getByLabelText("Portfolio example content")).toBeTruthy();
  expect(screen.getByLabelText("Badges example content")).toBeTruthy();
  expect(screen.getByLabelText("Latest Feedback example content")).toBeTruthy();
});

test("a user's real badges and links carry no example tag; the feedback section still does", async () => {
  world({ badges: ["First Ship"], portfolio_links: [{ title: "My site", url: "https://ana.dev" }] });
  const screen = renderWithProviders(<ProfileScreen />);
  expect(await screen.findByText("First Ship")).toBeTruthy();
  expect(screen.queryByText("Reliable Collaborator")).toBeNull();
  // Feedback has no real source until teammate kudos exist (Phase 5).
  expect(screen.getByLabelText("Latest Feedback example content")).toBeTruthy();
  expect(screen.queryByLabelText("Portfolio example content")).toBeNull();
  expect(screen.queryByLabelText("Badges example content")).toBeNull();
});

test("Open on a real portfolio link opens it", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  world({ badges: [], portfolio_links: [{ title: "My site", url: "https://ana.dev" }] });
  const screen = renderWithProviders(<ProfileScreen />);
  fireEvent.press(await screen.findByLabelText("Open My site"));
  expect(open).toHaveBeenCalledWith("https://ana.dev");
});

test("Open on a scheme-less link adds https://", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  world({ badges: [], portfolio_links: [{ title: "My site", url: "ana.dev" }] });
  const screen = renderWithProviders(<ProfileScreen />);
  fireEvent.press(await screen.findByLabelText("Open My site"));
  await waitFor(() => expect(open).toHaveBeenCalledWith("https://ana.dev"));
});

test("example portfolio links cannot be opened", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  expect(await screen.findByLabelText("Open Design Portfolio")).toBeDisabled();
});

test("the portfolio action edits your links", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  fireEvent.press(await screen.findByLabelText("Edit Portfolio"));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/(app)/settings/portfolio-links"));
});

test("the commit prompt does not promise an event that isn't recorded", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  db.respond((c) => {
    if (c.table === "profiles") return { data: { full_name: "Ana", badges: [], portfolio_links: [], skills: [] } };
    if (c.table === "projects") return { data: [] };
    if (c.table === "project_members") {
      return { data: [{ id: "m1", role: "Dev", mou_accepted: false,
        project: { id: "p1", title: "Aurora", project_type: null, status: "recruiting", owner_id: "owner" } }] };
    }
    return undefined;
  });
  const screen = renderWithProviders(<ProfileScreen />);
  // Exact match: the "Commitment Score" heading also contains "Commit".
  fireEvent.press(await screen.findByText("Commit"));
  const [, message] = alert.mock.calls[0];
  expect(message).not.toMatch(/collaboration event/);
  expect(message).toMatch(/team/);
});

test("an empty bio shows an Add a bio prompt, not invented text", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  expect(screen.queryByText(/Aspiring collaborator/)).toBeNull();
  fireEvent.press(await screen.findByLabelText("Add a bio"));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/(app)/settings/edit-profile"));
});

test("the Skills action edits your skills", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  fireEvent.press(await screen.findByLabelText("Edit Skills"));
  await waitFor(() =>
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/(app)/settings/skills", params: { from: "settings" } }),
  );
});

test("hint copy points at controls that exist", async () => {
  world({ badges: [], portfolio_links: [] });
  const screen = renderWithProviders(<ProfileScreen />);
  expect(await screen.findByText("No skills added yet. Tap Edit to add your skills.")).toBeTruthy();
  expect(screen.getByText("No projects yet. Tap + in the tab bar to create one.")).toBeTruthy();
});
