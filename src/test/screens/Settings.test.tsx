import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
const mockAuth = { user: { id: "me" }, signOut: jest.fn() };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import SettingsScreen from "../../../app/(app)/settings/index";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, supabase } from "@/test/supabaseMock";
import { routerState } from "@/test/routerMock";

function world() {
  db.respond((c) => {
    if (c.table === "projects") return { data: [] };
    if (c.table === "project_members") {
      return { data: [{ project_id: "p1", role: "Designer", projects: { id: "p1", title: "Lumen" } }] };
    }
    if (c.table === "profiles") return { data: { full_name: "Mia Member" } };
    return {};
  });
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

test("quitting goes through leave_project, then tells notify-owner only which project", async () => {
  world();
  const screen = renderWithProviders(<SettingsScreen />);
  fireEvent.press(await screen.findByText("Quit"));
  fireEvent.press(await screen.findByLabelText("Confirm leaving the project"));

  await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalled());
  expect(supabase.rpc).toHaveBeenCalledWith("leave_project", { p_project: "p1" });
  // The function builds the recipient and the text from the database.
  expect(supabase.functions.invoke).toHaveBeenCalledWith("notify-owner", { body: { projectId: "p1" } });
  await waitFor(() => expect(screen.queryByText("Lumen")).toBeNull());
});
