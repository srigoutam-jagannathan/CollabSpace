import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import CreateProject from "./CreateProject";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db } from "@/test/supabaseMock";
import { routerState } from "@/test/routerMock";

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  db.respond((c) => (c.table === "projects" && c.op === "insert" ? { data: { id: "p1" } } : undefined));
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

function fillRequired(screen: ReturnType<typeof renderWithProviders>) {
  fireEvent.changeText(screen.getByPlaceholderText("e.g. Mental Health Journaling App"), "Study buddy");
  fireEvent.changeText(
    screen.getByPlaceholderText("Describe your project..."),
    "An app that pairs students for focused study sessions."
  );
}

function typeDate(screen: ReturnType<typeof renderWithProviders>, index: number, digits: string) {
  const input = () => screen.getAllByPlaceholderText("DD/MM/YYYY")[index];
  for (const d of digits) fireEvent.changeText(input(), input().props.value + d);
}

test("dates typed as digits get their slashes and are saved as ISO dates", async () => {
  const screen = renderWithProviders(<CreateProject />);
  fillRequired(screen);
  typeDate(screen, 0, "03102026");
  typeDate(screen, 1, "25122026");
  expect(screen.getAllByPlaceholderText("DD/MM/YYYY")[0].props.value).toBe("03/10/2026");

  fireEvent.press(screen.getByText("Post Now"));
  await waitFor(() => expect(db.callsTo("projects")).toHaveLength(1));
  // Sent raw, Postgres would read 03/10/2026 as 10 March and reject 25/12/2026.
  expect(db.callsTo("projects")[0].payload).toMatchObject({ start_date: "2026-10-03", end_date: "2026-12-25" });
});

test("an impossible date is caught before anything is saved", async () => {
  const screen = renderWithProviders(<CreateProject />);
  fillRequired(screen);
  typeDate(screen, 0, "31042026");

  fireEvent.press(screen.getByText("Post Now"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Check the dates", expect.any(String)));
  expect(db.callsTo("projects")).toHaveLength(0);
});

test("dates are optional", async () => {
  const screen = renderWithProviders(<CreateProject />);
  fillRequired(screen);

  fireEvent.press(screen.getByText("Post Now"));
  await waitFor(() => expect(db.callsTo("projects")).toHaveLength(1));
  expect(db.callsTo("projects")[0].payload).toMatchObject({ start_date: null, end_date: null });
});

test("the owner joins their own project already approved", async () => {
  const screen = renderWithProviders(<CreateProject />);
  fillRequired(screen);

  fireEvent.press(screen.getByText("Post Now"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
  // New member rows default to pending; only the owner may write "approved".
  expect(db.callsTo("project_members")[0].payload).toMatchObject({ user_id: "me", status: "approved" });
});
