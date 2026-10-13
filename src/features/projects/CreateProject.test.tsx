import { AccessibilityInfo, Alert } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

// The latest usePreventRemove call, so tests can see whether leaving is blocked and
// play the swipe-back / hardware-back event through its callback.
type PreventCallback = (options: { data: { action: unknown } }) => void;
const mockPrevent: { active: boolean; callback: PreventCallback | null } = { active: false, callback: null };
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (active: boolean, callback: PreventCallback) => {
    mockPrevent.active = active;
    mockPrevent.callback = callback;
  },
}));

import CreateProject from "./CreateProject";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db } from "@/test/supabaseMock";
import { mockNavigation, mockRouter, routerState } from "@/test/routerMock";

type Screen = ReturnType<typeof renderWithProviders>;
type AlertButton = { text: string; style?: string; onPress?: () => void };

let alertSpy: jest.SpyInstance;
// Btn ignores a second press within 500ms; clockOffset lets a test press Back again "later".
const realNow = Date.now.bind(Date);
let clockOffset = 0;
let dateSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  mockPrevent.active = false;
  mockPrevent.callback = null;
  clockOffset = 0;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => realNow() + clockOffset);
  db.respond((c) => (c.table === "projects" && c.op === "insert" ? { data: { id: "p1" } } : undefined));
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => {
  alertSpy.mockRestore();
  dateSpy.mockRestore();
});

/** Taps the header Back a second after any earlier tap. */
function pressBack(screen: Screen) {
  clockOffset += 1000;
  fireEvent.press(screen.getByLabelText("Back"));
}

/** Presses a button of the last Alert shown. */
function pressAlertButton(text: string) {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
  act(() => buttons.find((b) => b.text === text)?.onPress?.());
}

const SWIPE_BACK = { type: "GO_BACK" };
function swipeBack() {
  act(() => mockPrevent.callback?.({ data: { action: SWIPE_BACK } }));
}

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

test("a description that's too short says how many characters it still needs, politely", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fireEvent.changeText(screen.getByPlaceholderText(TITLE), "Aurora");
  fireEvent.changeText(screen.getByPlaceholderText(DESCRIPTION), "Too short");
  fireEvent.press(screen.getByText("Next"));
  const message = screen.getByText("Description needs 11 more characters");
  expect(message.props.accessibilityLiveRegion).toBe("polite");
  expect(screen.getByText("Step 2 of 4")).toBeTruthy();
});

test("each step's heading is a header, and step changes are announced (not the first one)", () => {
  // Already a jest.fn in React Native's mock, so earlier tests' calls are cleared too.
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear().mockImplementation(() => {});
  const screen = renderWithProviders(<CreateProject />);
  expect(screen.getByRole("header", { name: "What are you starting?" })).toBeTruthy();
  expect(announce).not.toHaveBeenCalled();

  pickType(screen);
  expect(announce).toHaveBeenLastCalledWith("Step 2 of 4");
  expect(screen.getByRole("header", { name: "Name it and describe it" })).toBeTruthy();
  fillDetails(screen);
  expect(announce).toHaveBeenLastCalledWith("Step 3 of 4");
  expect(screen.getByRole("header", { name: "Who do you need?" })).toBeTruthy();
  pickRoles(screen);
  expect(screen.getByRole("header", { name: "When and where?" })).toBeTruthy();
  announce.mockRestore();
});

test("tiles read their hint to screen readers", () => {
  const screen = renderWithProviders(<CreateProject />);
  expect(screen.getByLabelText("Passion project").props.accessibilityHint).toBe("Something you want to exist");
});

test("the learners toggle is a switch that turns on and off again", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  const toggle = () => screen.getByLabelText("Open to learners");
  expect(toggle().props.accessibilityRole).toBe("switch");
  expect(toggle().props.accessibilityState).toMatchObject({ checked: false });
  fireEvent.press(toggle());
  expect(toggle().props.accessibilityState).toMatchObject({ checked: true });
  fireEvent.press(toggle());
  expect(toggle().props.accessibilityState).toMatchObject({ checked: false });
});

test("Back on later steps goes back one and keeps what you entered", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  fireEvent.press(screen.getByLabelText("Need UI/UX"));
  pressBack(screen);
  expect(screen.getByPlaceholderText(TITLE).props.value).toBe("Aurora");
  fireEvent.press(screen.getByText("Next"));
  expect(screen.getByLabelText("Need UI/UX").props.accessibilityState).toMatchObject({ selected: true });

  pressBack(screen);
  pressBack(screen);
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test("Back on the first step with nothing entered leaves", () => {
  const screen = renderWithProviders(<CreateProject />);
  pressBack(screen);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test("Back on the first step with a draft asks before throwing it away", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  pressBack(screen);
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  pressBack(screen);
  expect(alertSpy).toHaveBeenCalledWith("Discard this project?", "You'll lose what you've entered.", expect.any(Array));
  expect(mockRouter.back).not.toHaveBeenCalled();

  pressAlertButton("Keep editing");
  expect(mockRouter.back).not.toHaveBeenCalled();
  pressBack(screen);
  pressAlertButton("Discard");
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test("a quick double tap on Back goes back one step, not out of the flow", () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fireEvent.press(screen.getByLabelText("Back"));
  fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test("swipe-back and hardware back are blocked once there is something to lose", () => {
  const screen = renderWithProviders(<CreateProject />);
  expect(mockPrevent.active).toBe(false);
  pickType(screen);
  expect(mockPrevent.active).toBe(true);

  // On a later step it goes back one step instead of leaving.
  swipeBack();
  expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();

  // On step 1 it asks, and Discard lets the original action through.
  swipeBack();
  expect(alertSpy).toHaveBeenCalledWith("Discard this project?", "You'll lose what you've entered.", expect.any(Array));
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  pressAlertButton("Discard");
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(SWIPE_BACK);
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

test("after posting, the guard lets the replace through without asking", async () => {
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  pickWhenWhere(screen);
  fireEvent.press(screen.getByText("Post project"));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());

  // router.replace removes this screen, which fires the same event as a swipe-back.
  const REPLACE = { type: "REPLACE" };
  act(() => mockPrevent.callback?.({ data: { action: REPLACE } }));
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(REPLACE);
  expect(screen.getByText("Step 4 of 4")).toBeTruthy();
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
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  db.respond((c) => (c.table === "projects" ? { data: null, error: { code: "42501", message: "denied" } } : undefined));
  const screen = renderWithProviders(<CreateProject />);
  pickType(screen);
  fillDetails(screen);
  pickRoles(screen);
  pickWhenWhere(screen);
  fireEvent.press(screen.getByText("Post project"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Could not create project", "denied"));
  expect(screen.getByText("Step 4 of 4")).toBeTruthy();
  expect(consoleError).toHaveBeenCalled();
  consoleError.mockRestore();
});
