import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import CreateProject from "./CreateProject";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

type Screen = ReturnType<typeof renderWithProviders>;

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  db.respond((c) => (c.table === "projects" && c.op === "insert" ? { data: { id: "p1" } } : undefined));
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

const TITLE = "e.g. Mental Health Journaling App";
const DESCRIPTION = "What is it, and what will the team do?";

function pickType(screen: Screen) {
  fireEvent.press(screen.getByLabelText("Passion project"));
}
function fillDetails(screen: Screen) {
  fireEvent.changeText(screen.getByPlaceholderText(TITLE), "Aurora");
  fireEvent.changeText(screen.getByPlaceholderText(DESCRIPTION), "A night-sky photography app for students.");
  fireEvent.press(screen.getByText("Next"));
}
function pickRoles(screen: Screen) {
  fireEvent.press(screen.getByLabelText("Need UI/UX"));
  fireEvent.press(screen.getByLabelText("Need Marketing"));
  fireEvent.press(screen.getByText("Next"));
}
function pickWhenWhere(screen: Screen) {
  fireEvent.press(screen.getByLabelText("1–3 months"));
  fireEvent.press(screen.getByLabelText("Remote"));
  fireEvent.press(screen.getByLabelText("5 hrs a week"));
}

test("opens on the project type, and picking one moves on to the details", () => {
  const screen = renderWithProviders(<CreateProject />);
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  pickType(screen);
  expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  expect(screen.getByPlaceholderText(TITLE)).toBeTruthy();
});

test("only the title and description are typed", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  expect(screen.UNSAFE_queryAllByType(require("react-native").TextInput)).toHaveLength(2);
});

test("details need a 3-character title and a 20-character description", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fireEvent.changeText(screen.getByPlaceholderText(TITLE), "Au");
  fireEvent.press(screen.getByText("Next"));
  expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  expect(screen.getByText("Title must be at least 3 characters")).toBeTruthy();
});

test("Back on the first step leaves; later steps go back one and keep what you entered", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  fireEvent.press(screen.getByLabelText("Need UI/UX"));
  fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByPlaceholderText(TITLE).props.value).toBe("Aurora");
  fireEvent.press(screen.getByText("Next"));
  expect(screen.getByLabelText("Need UI/UX").props.accessibilityState).toMatchObject({ selected: true });

  fireEvent.press(screen.getByLabelText("Back"));
  fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Back"));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test("roles: tap to add or remove, type one the list lacks, and at least one is needed", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  expect(screen.getByText("Step 3 of 4")).toBeTruthy();
  fireEvent.press(screen.getByText("Next"));
  expect(screen.getByText("Step 3 of 4")).toBeTruthy(); // no role yet, so Next does nothing

  fireEvent.press(screen.getByLabelText("Need Design"));
  fireEvent.press(screen.getByLabelText("Need Design"));
  expect(screen.getByLabelText("Need Design").props.accessibilityState).toMatchObject({ selected: false });

  fireEvent.press(screen.getByLabelText("Add a role that isn't listed"));
  fireEvent.changeText(screen.getByPlaceholderText("e.g. Beekeeper"), "Beekeeper");
  fireEvent.press(screen.getByLabelText("Add Beekeeper"));
  expect(screen.getByLabelText("Need Beekeeper").props.accessibilityState).toMatchObject({ selected: true });
});

test("the preview shows the listing, and Edit goes back to that step", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  pickWhenWhere(screen);
  expect(screen.getByText("Aurora")).toBeTruthy();
  expect(screen.getByText("1–3 months · 5 hrs a week")).toBeTruthy();

  fireEvent.press(screen.getByLabelText("Edit details"));
  expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  expect(screen.getByPlaceholderText(TITLE).props.value).toBe("Aurora");
});

test("posting saves the whole draft, with no exact dates", async () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  fireEvent.press(screen.getByLabelText("Open to learners"));
  pickRoles(screen);
  pickWhenWhere(screen);
  fireEvent.press(screen.getByText("Post project"));

  await waitFor(() => expect(db.callsTo("projects")).toHaveLength(1));
  expect(db.callsTo("projects")[0].payload).toMatchObject({
    title: "Aurora",
    project_type: "Side Project",
    duration: "1_3_months",
    collaboration_style: "Remote",
    commitment_hours: 5,
    open_to_learners: true,
    start_date: null,
    end_date: null,
    role_requirements: [{ role: "UI/UX", description: "" }, { role: "Marketing", description: "" }],
  });
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/(app)/projects/[id]/preview", params: { id: "p1" } })
  );
});

test("Post waits until duration, place and hours are all picked", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  fireEvent.press(screen.getByLabelText("1–3 months"));
  fireEvent.press(screen.getByText("Post project"));
  expect(db.callsTo("projects")).toHaveLength(0);
});

test("the owner joins their own project already approved", async () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  pickWhenWhere(screen);
  fireEvent.press(screen.getByText("Post project"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
  // New member rows default to pending; only the owner may write "approved".
  expect(db.callsTo("project_members")[0].payload).toMatchObject({ user_id: "me", status: "approved" });
});

test("a failed insert says so and stays on the preview", async () => {
  db.respond((c) => (c.table === "projects" ? { data: null, error: { code: "42501", message: "denied" } } : undefined));
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  pickWhenWhere(screen);
  fireEvent.press(screen.getByText("Post project"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Could not create project", "denied"));
  expect(screen.getByText("Step 4 of 4")).toBeTruthy();
});
