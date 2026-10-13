import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import JoinProjectScreen from "../../../app/(app)/projects/[id]/join";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has } from "@/test/supabaseMock";
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
  world();
  const screen = renderWithProviders(<JoinProjectScreen />);
  await screen.findByText("Aurora");
  fireEvent.press(screen.getByText("Designer"));
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
    "Request sent", expect.stringMatching(/Notifications/), expect.any(Array),
  ));
});
