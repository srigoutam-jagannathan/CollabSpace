import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
const mockAuth = { user: { id: "me" } };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import ProjectPreviewScreen from "../../../app/(app)/projects/[id]/preview";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, supabase } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

function world({ member, leave = "leaves" }: { member: boolean; leave?: "leaves" | "refused" }) {
  if (leave === "refused") {
    supabase.rpc.mockResolvedValue({
      data: null, error: { code: "42501", message: "not a member of this project" },
    });
  }
  db.respond((c) => {
    if (c.table === "projects") {
      return {
        data: {
          id: "p1", owner_id: "owner", title: "Version 2.0 of sidequest", description: "",
          tags: [], looking_for: [], owner: { full_name: "Olive Owner" },
        },
      };
    }
    if (c.table === "project_members") return { data: member ? { id: "m1" } : null };
    if (c.table === "profiles") return { data: { full_name: "Mia Member" } };
    return {};
  });
}

const renderPreview = () => renderWithProviders(<ProjectPreviewScreen />);

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  routerState.setParams({ id: "p1" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

async function leave(screen: ReturnType<typeof renderPreview>) {
  fireEvent.press(await screen.findByLabelText("Leave Project"));
  fireEvent.press(await screen.findByLabelText("Confirm leaving the project"));
}

test("back pops to whatever opened the preview", async () => {
  world({ member: false });
  const screen = renderPreview();
  fireEvent.press(await screen.findByText("Back"));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

test("a non-member is offered Join, not Leave", async () => {
  world({ member: false });
  const screen = renderPreview();
  expect(await screen.findByText("Join Project")).toBeTruthy();
  expect(screen.queryByLabelText("Leave Project")).toBeNull();
});

test("leaving goes through leave_project, tells the owner, and moves on", async () => {
  world({ member: true });
  const screen = renderPreview();
  await leave(screen);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(app)/projects"));
  // The RPC deletes the row, logs member_quit and posts to the chat, server-side.
  expect(supabase.rpc).toHaveBeenCalledWith("leave_project", { p_project: "p1" });
  expect(db.callsTo("project_members").filter((c) => c.op === "delete")).toHaveLength(0);
  expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);
  expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
  // Only which project: the function builds the recipient and text from the database.
  expect(supabase.functions.invoke).toHaveBeenCalledWith("notify-owner", { body: { projectId: "p1" } });
});

test("a leave the RPC refuses is reported, and nothing else happens", async () => {
  world({ member: true, leave: "refused" });
  const screen = renderPreview();
  await leave(screen);

  await waitFor(() =>
    expect(alertSpy).toHaveBeenCalledWith("Error", "Could not leave the project. Please try again.")
  );
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);

  expect(supabase.functions.invoke).not.toHaveBeenCalled();
  expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
});

function projectWorld(extra: Record<string, unknown>) {
  db.respond((c) => {
    if (c.table === "projects") {
      return { data: {
        id: "p1", owner_id: "owner", title: "Aurora", description: "", tags: [], looking_for: [],
        owner: { full_name: "Olive Owner" }, ...extra,
      } };
    }
    if (c.table === "project_members") return { data: null };
    return {};
  });
}

test("shows the project's rough duration and that learners are welcome", async () => {
  projectWorld({ duration: "1_3_months", commitment_hours: 5, open_to_learners: true });
  const screen = renderPreview();
  expect(await screen.findByText("1–3 months · 5 hrs a week")).toBeTruthy();
  expect(screen.getByText("Open to learners")).toBeTruthy();
});

test("a project with no timeframe and not open to learners shows neither line", async () => {
  projectWorld({ duration: null, start_date: null, end_date: null, commitment_hours: 0, open_to_learners: false });
  const screen = renderPreview();
  await screen.findByText("Aurora");
  expect(screen.queryByText(/a week/)).toBeNull();
  expect(screen.queryByText("Open to learners")).toBeNull();
});
